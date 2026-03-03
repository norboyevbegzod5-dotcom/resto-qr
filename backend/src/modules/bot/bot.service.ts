import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Telegraf, Context, Markup } from 'telegraf';
import { PrismaService } from '../../common/prisma.service';
import { VouchersService } from '../vouchers/vouchers.service';
import { UsersService } from '../users/users.service';
import { CampaignsService } from '../campaigns/campaigns.service';

interface BotInstance {
  id: number;
  name: string;
  username: string;
  brandId: number | null;
  miniAppUrl: string | null;
  telegraf: Telegraf;
}

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bots: Map<number, BotInstance> = new Map();

  constructor(
    private prisma: PrismaService,
    private vouchersService: VouchersService,
    private usersService: UsersService,
    private campaignsService: CampaignsService,
    private httpAdapterHost: HttpAdapterHost,
  ) {}

  async onModuleInit() {
    const baseUrl = process.env.RENDER_EXTERNAL_URL;
    if (baseUrl) {
      this.logger.log('Using webhooks (RENDER_EXTERNAL_URL set)');
      await this.registerWebhooks(baseUrl);
    } else {
      setImmediate(() => {
        this.launchAllBots().catch((e) =>
          this.logger.error('Failed to launch bots on startup', e),
        );
      });
    }
  }

  async onModuleDestroy() {
    for (const [, bot] of this.bots) {
      bot.telegraf.stop();
    }
    this.bots.clear();
  }

  async launchAllBots() {
    const dbBots = await this.prisma.telegramBot.findMany({
      where: { isActive: true },
    });

    if (dbBots.length === 0) {
      this.logger.warn('No active bots found in database');
      return;
    }

    for (const dbBot of dbBots) {
      await this.launchBot(dbBot);
    }

    this.logger.log(`Launched ${this.bots.size} bot(s)`);
  }

  private webhookRouteRegistered = false;

  async registerWebhooks(baseUrl: string) {
    const dbBots = await this.prisma.telegramBot.findMany({
      where: { isActive: true },
    });

    if (dbBots.length === 0) {
      this.logger.warn('No active bots found in database');
      return;
    }

    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const expressApp = httpAdapter.getInstance();
    const domain = baseUrl.replace(/^https?:\/\//, '');

    if (!this.webhookRouteRegistered) {
      expressApp.post('/webhook/bot/:id', async (req: any, res: any) => {
        const id = parseInt(req.params.id, 10);
        const instance = this.bots.get(id);
        if (!instance) {
          res.status(404).end();
          return;
        }
        try {
          await instance.telegraf.handleUpdate(req.body, res);
          if (!res.writableEnded) res.end();
        } catch (e) {
          this.logger.error(`Webhook error for bot ${id}: ${(e as Error).message}`);
          if (!res.writableEnded) res.writeHead(500).end();
        }
      });
      this.webhookRouteRegistered = true;
      this.logger.log('Webhook route registered');
    }

    for (const dbBot of dbBots) {
      try {
        const telegraf = new Telegraf(dbBot.token);
        const instance: BotInstance = {
          id: dbBot.id,
          name: dbBot.name,
          username: dbBot.username,
          brandId: dbBot.brandId,
          miniAppUrl: dbBot.miniAppUrl,
          telegraf,
        };

        this.registerHandlers(instance);
        this.bots.set(dbBot.id, instance);

        const path = `/webhook/bot/${dbBot.id}`;
        const url = `${baseUrl.replace(/\/$/, '')}${path}`;
        await telegraf.telegram.setWebhook(url);

        this.logger.log(`Bot "${dbBot.name}" (@${dbBot.username}) webhook at ${url}`);
      } catch (e: any) {
        this.logger.error(`Failed to register webhook for "${dbBot.name}": ${e.message}`);
      }
    }

    this.logger.log(`Registered ${this.bots.size} webhook(s)`);
  }

  async launchBot(dbBot: { id: number; name: string; token: string; username: string; brandId: number | null; miniAppUrl: string | null }) {
    if (this.bots.has(dbBot.id)) {
      this.logger.warn(`Bot "${dbBot.name}" already running, skipping`);
      return;
    }

    const LAUNCH_TIMEOUT_MS = 45000;
    const MAX_RETRIES = 2;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const telegraf = new Telegraf(dbBot.token);
        const instance: BotInstance = {
          id: dbBot.id,
          name: dbBot.name,
          username: dbBot.username,
          brandId: dbBot.brandId,
          miniAppUrl: dbBot.miniAppUrl,
          telegraf,
        };

        this.registerHandlers(instance);

        const launchPromise = telegraf.launch();
        const timeout = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Launch timeout')), LAUNCH_TIMEOUT_MS),
        );
        await Promise.race([launchPromise, timeout]);

        this.bots.set(dbBot.id, instance);
        this.logger.log(`Bot "${dbBot.name}" (@${dbBot.username}) started`);
        return;
      } catch (e: any) {
        this.logger.warn(`Bot "${dbBot.name}" attempt ${attempt}/${MAX_RETRIES}: ${e.message}`);
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 5000));
        } else {
          this.logger.error(`Failed to start bot "${dbBot.name}": ${e.message}`);
        }
      }
    }
  }

  async stopBot(botId: number) {
    const instance = this.bots.get(botId);
    if (instance) {
      instance.telegraf.stop();
      this.bots.delete(botId);
      this.logger.log(`Bot "${instance.name}" stopped`);
    }
  }

  async restartBot(botId: number) {
    await this.stopBot(botId);
    const baseUrl = process.env.RENDER_EXTERNAL_URL;
    const dbBot = await this.prisma.telegramBot.findUnique({ where: { id: botId } });
    if (!dbBot || !dbBot.isActive) return;
    if (baseUrl) {
      await this.registerWebhooks(baseUrl);
    } else {
      await this.launchBot(dbBot);
    }
  }

  getRunningBots() {
    return Array.from(this.bots.values()).map((b) => ({
      id: b.id,
      name: b.name,
      username: b.username,
      running: true,
    }));
  }

  async ensureBotsRunning() {
    const dbBots = await this.prisma.telegramBot.findMany({
      where: { isActive: true },
    });

    for (const dbBot of dbBots) {
      if (!this.bots.has(dbBot.id)) {
        this.logger.log(`Auto-launching bot "${dbBot.name}" (was not running)`);
        await this.launchBot(dbBot);
      }
    }
  }

  // ── Отправка сообщений пользователям ──

  async sendMessageToUser(chatId: string, message: string): Promise<boolean> {
    const firstBot = this.bots.values().next().value;
    if (!firstBot) {
      this.logger.warn('No running bots to send message');
      return false;
    }

    try {
      await firstBot.telegraf.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
      return true;
    } catch (e: any) {
      this.logger.error(`Failed to send to ${chatId}: ${e.message}`);
      return false;
    }
  }

  async getFileBuffer(fileId: string, botId?: number | null): Promise<Buffer | null> {
    const botsToTry: BotInstance[] = [];
    if (botId) {
      const specified = this.bots.get(botId);
      if (specified) botsToTry.push(specified);
    }
    for (const [id, inst] of this.bots) {
      if (!botsToTry.includes(inst)) botsToTry.push(inst);
    }
    if (botsToTry.length === 0) return null;

    for (const instance of botsToTry) {
      try {
        const link = await instance.telegraf.telegram.getFileLink(fileId);
        const res = await fetch(link.href);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        return Buffer.from(arr);
      } catch {
        continue;
      }
    }
    this.logger.error(`Failed to get file ${fileId} from any bot`);
    return null;
  }

  async broadcastToUsers(
    chatIds: string[],
    message: string,
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const chatId of chatIds) {
      const ok = await this.sendMessageToUser(chatId, message);
      if (ok) sent++;
      else failed++;

      await new Promise((r) => setTimeout(r, 35));
    }

    return { sent, failed };
  }

  // ── Регистрация хендлеров для каждого бота ──

  private registerHandlers(bot: BotInstance) {
    const { telegraf } = bot;

    telegraf.start(async (ctx) => {
      try {
        await this.handleStart(ctx, bot);
      } catch (e) {
        this.logger.error(`[${bot.name}] Error in /start`, e);
        await ctx.reply('Произошла ошибка. Попробуйте позже.');
      }
    });

    telegraf.hears(/👤 Профиль|👤 Profil/i, async (ctx) => {
      try { await this.handleProfile(ctx, bot); }
      catch (e) { this.logger.error(`[${bot.name}] Error in profile`, e); }
    });

    telegraf.hears(/🎁 Акция|🎁 Aksiya/i, async (ctx) => {
      try { await this.handlePromo(ctx); }
      catch (e) { this.logger.error(`[${bot.name}] Error in promo`, e); }
    });

    telegraf.hears(/📋 Меню|📋 Menyu/i, async (ctx) => {
      try { await this.handleMenu(ctx, bot); }
      catch (e) { this.logger.error(`[${bot.name}] Error in menu`, e); }
    });

    telegraf.hears(/🌐 Язык|🌐 Til/i, async (ctx) => {
      try { await this.handleLanguage(ctx); }
      catch (e) { this.logger.error(`[${bot.name}] Error in language`, e); }
    });

    telegraf.hears(/📞 Контакты|📞 Kontaktlar/i, async (ctx) => {
      try { await this.handleContacts(ctx, bot); }
      catch (e) { this.logger.error(`[${bot.name}] Error in contacts`, e); }
    });

    telegraf.hears(/📷 Загрузить чек|📷 Chek yuklash/i, async (ctx) => {
      try { await this.handleReceiptRequest(ctx, bot); }
      catch (e) { this.logger.error(`[${bot.name}] Error in receipt request`, e); }
    });

    telegraf.on('photo', async (ctx) => {
      try { await this.handleReceiptPhoto(ctx, bot); }
      catch (e) { this.logger.error(`[${bot.name}] Error in receipt photo`, e); }
    });

    telegraf.on('contact', async (ctx) => {
      try { await this.handleContact(ctx); }
      catch (e) { this.logger.error(`[${bot.name}] Error in contact`, e); }
    });

    telegraf.action(/lang_(.+)/, async (ctx) => {
      try {
        const lang = ctx.match[1];
        const chatId = ctx.from!.id.toString();
        const user = await this.usersService.findOrCreateByChatId(chatId, ctx.from?.first_name);
        await this.usersService.updateLanguage(chatId, lang);
        await ctx.answerCbQuery();

        if (!user.phone) {
          const greeting = lang === 'UZ'
            ? 'Til tanlandi: O\'zbekcha\nTelefon raqamingizni yuboring:'
            : 'Язык выбран: Русский\nОтправьте ваш номер телефона:';
          await ctx.reply(greeting, Markup.keyboard([
            Markup.button.contactRequest(lang === 'UZ' ? '📱 Raqamni yuborish' : '📱 Отправить номер'),
          ]).resize());
          await this.usersService.updateBotStep(chatId, 'AWAITING_PHONE');
        } else {
          const msg = lang === 'UZ' ? 'Til o\'zgartirildi.' : 'Язык изменён.';
          await ctx.reply(msg, this.getMainKeyboard(lang));
        }
      } catch (e) {
        this.logger.error(`[${bot.name}] Error in lang selection`, e);
      }
    });
  }

  // ── /start ──

  private async handleStart(ctx: Context, bot: BotInstance) {
    const chatId = ctx.from!.id.toString();
    const name = ctx.from?.first_name || undefined;
    const payload = (ctx as any).startPayload as string | undefined;

    const user = await this.usersService.findOrCreateByChatId(chatId, name);

    if (!user.botLanguage) {
      if (payload?.startsWith('CODE_')) {
        await this.usersService.updatePendingVoucherCode(chatId, payload.replace('CODE_', ''));
      }
      await ctx.reply(
        '🌐 Выберите язык / Tilni tanlang:',
        Markup.inlineKeyboard([
          Markup.button.callback('🇷🇺 Русский', 'lang_RU'),
          Markup.button.callback('🇺🇿 O\'zbekcha', 'lang_UZ'),
        ]),
      );
      return;
    }

    if (!user.phone) {
      if (payload?.startsWith('CODE_')) {
        await this.usersService.updatePendingVoucherCode(chatId, payload.replace('CODE_', ''));
      }
      const lang = user.botLanguage;
      await ctx.reply(
        lang === 'UZ'
          ? '📱 Ro\'yxatdan o\'tish majburiy. Telefon raqamingizni yuboring:'
          : '📱 Регистрация обязательна. Отправьте ваш номер телефона:',
        Markup.keyboard([
          Markup.button.contactRequest(lang === 'UZ' ? '📱 Raqamni yuborish' : '📱 Отправить номер'),
        ]).resize(),
      );
      await this.usersService.updateBotStep(chatId, 'AWAITING_PHONE');
      return;
    }

    if (payload && payload.startsWith('CODE_')) {
      const code = payload.replace('CODE_', '');
      await this.activateVoucherForUser(ctx, chatId, code, name, user.phone);
      await this.sendMainMenu(ctx, user.botLanguage);
      return;
    }

    const lang = user.botLanguage;
    await ctx.reply(
      lang === 'UZ'
        ? `Assalomu alaykum, ${user.name || 'do\'st'}! 👋\n${bot.name} botiga xush kelibsiz!\nQuyidagi tugmalardan birini tanlang:`
        : `Здравствуйте, ${user.name || 'друг'}! 👋\nДобро пожаловать в бот ${bot.name}!\nВыберите действие:`,
      this.getMainKeyboard(lang),
    );
  }

  private async requireRegistration(ctx: Context, chatId: string): Promise<{ ok: boolean; lang?: string }> {
    const user = await this.usersService.findOrCreateByChatId(chatId);
    if (!user.botLanguage) {
      await ctx.reply('🌐 Выберите язык / Tilni tanlang:', Markup.inlineKeyboard([
        Markup.button.callback('🇷🇺 Русский', 'lang_RU'),
        Markup.button.callback('🇺🇿 O\'zbekcha', 'lang_UZ'),
      ]));
      return { ok: false };
    }
    if (!user.phone) {
      const lang = user.botLanguage;
      await ctx.reply(
        lang === 'UZ'
          ? '📱 Avval ro\'yxatdan o\'ting. Telefon raqamingizni yuboring:'
          : '📱 Сначала зарегистрируйтесь. Отправьте ваш номер телефона:',
        Markup.keyboard([Markup.button.contactRequest(lang === 'UZ' ? '📱 Raqamni yuborish' : '📱 Отправить номер')]).resize(),
      );
      await this.usersService.updateBotStep(chatId, 'AWAITING_PHONE');
      return { ok: false };
    }
    return { ok: true, lang: user.botLanguage };
  }

  // ── Активация кода ──

  private async activateVoucherForUser(ctx: Context, chatId: string, code: string, name?: string, phone?: string | null) {
    try {
      const result = await this.vouchersService.activateCode(chatId, code, name, phone || undefined);
      const brandList = result.brands.map((b) => `  • ${b.brand}: ${b.count}`).join('\n');

      const campaign = await this.campaignsService.getActive();
      const remainingVouchers = campaign ? campaign.minVouchers - result.totalVouchers : 0;
      const remainingBrands = campaign ? campaign.minBrands - result.brandCount : 0;

      let statusMsg: string;
      if (result.eligible) {
        statusMsg = '🎉 Поздравляем! Вы выполнили все условия акции и участвуете в розыгрыше!';
      } else if (remainingVouchers <= 3 && remainingVouchers > 0) {
        statusMsg = `🔥 Осталось всего ${remainingVouchers} купон(ов) до участия в розыгрыше!`;
      } else if (remainingVouchers === 1) {
        statusMsg = '⚡ Ещё один купон — и вы участвуете в розыгрыше!';
      } else {
        const parts: string[] = [];
        if (remainingVouchers > 0) parts.push(`${remainingVouchers} купон(ов)`);
        if (remainingBrands > 0) parts.push(`${remainingBrands} бренд(ов)`);
        statusMsg = `⏳ До участия осталось: ${parts.join(', ')}. Продолжайте собирать!`;
      }

      const msg = `✅ Код ${result.code} успешно активирован!\n\n📊 Ваши коды: ${result.totalVouchers}\n📋 Бренды:\n${brandList}\n\n${statusMsg}`;

      await ctx.reply(msg);
    } catch (e: any) {
      const errData = e?.response;
      if (errData?.error === 'INVALID_CODE') {
        await ctx.reply('❌ Неверный код. Проверьте и попробуйте снова.');
      } else if (errData?.error === 'ALREADY_ACTIVATED') {
        await ctx.reply('⚠️ Этот код уже был активирован.');
      } else if (errData?.error === 'CAMPAIGN_INACTIVE' || errData?.error === 'CAMPAIGN_EXPIRED') {
        await ctx.reply('⏰ Акция завершена или ещё не началась.');
      } else {
        await ctx.reply('❌ Произошла ошибка при активации кода.');
      }
    }
  }

  // ── Профиль ──

  private async handleProfile(ctx: Context, bot: BotInstance) {
    const chatId = ctx.from!.id.toString();
    const reg = await this.requireRegistration(ctx, chatId);
    if (!reg.ok) return;
    const user = await this.usersService.findOrCreateByChatId(chatId);
    const lang = reg.lang || user.botLanguage || 'RU';
    const stats = await this.usersService.getUserStats(chatId);

    if (!stats || stats.totalVouchers === 0) {
      const msg = lang === 'UZ'
        ? `👤 Sizning profilingiz\n\n📛 Ism: ${user.name || '—'}\n📱 Telefon: ${user.phone || '—'}\n\n🎟 Sizda hali kuponlar yo'q.\nKupondagi QR-kodni skanerlang!`
        : `👤 Ваш профиль\n\n📛 Имя: ${user.name || '—'}\n📱 Телефон: ${user.phone || '—'}\n\n🎟 У вас пока нет купонов.\nОтсканируйте QR-код на купоне!`;
      await ctx.reply(msg);
      return;
    }

    const brandList = stats.brands.map((b) => `  • ${b.brand}: ${b.count}`).join('\n');
    const campaignTitle = stats.campaign?.title || (lang === 'UZ' ? 'Joriy aksiya' : 'Текущая акция');

    let eligibleText: string;
    if (lang === 'UZ') {
      eligibleText = stats.eligible
        ? '🎉 Siz barcha shartlarni bajardingiz va o\'yinda ishtirok etasiz!'
        : `⏳ Ishtirok uchun: kamida ${stats.campaign?.minVouchers || '?'} kupon, ${stats.campaign?.minBrands || '?'} brenddan`;
    } else {
      eligibleText = stats.eligible
        ? '🎉 Вы выполнили все условия и участвуете в розыгрыше!'
        : `⏳ Для участия нужно: минимум ${stats.campaign?.minVouchers || '?'} кодов от ${stats.campaign?.minBrands || '?'} брендов`;
    }

    const header = lang === 'UZ' ? '👤 Sizning profilingiz' : '👤 Ваш профиль';
    const nameLabel = lang === 'UZ' ? 'Ism' : 'Имя';
    const phoneLabel = lang === 'UZ' ? 'Telefon' : 'Телефон';
    const codesLabel = lang === 'UZ' ? 'Kuponlar soni' : 'Всего купонов';
    const brandsLabel = lang === 'UZ' ? 'Brendlar' : 'Бренды';

    await ctx.reply(
      `${header}\n\n📛 ${nameLabel}: ${user.name || '—'}\n📱 ${phoneLabel}: ${user.phone || '—'}\n\n🎟 ${campaignTitle}\n📊 ${codesLabel}: ${stats.totalVouchers}\n📋 ${brandsLabel} (${stats.brandCount}):\n${brandList}\n\n${eligibleText}`,
    );
  }

  // ── Акция ──

  private readonly PROMO_TEXT_RU = `🎁 Розыгрыш автомобиля 

Друзья, мы разыгрываем автомобиль Forthing S7!
Рестораны Uzbekona, Dolcetta и Resto совместно с Pepsi, Grace Travel и Forthing запускают масштабную акцию.

🎁 Помимо главного приза вас ждут:
• Путёвка в Дубай на двоих
• Путёвка в Египет на двоих
• 2 iPhone 17 Pro Max
• Сертификаты от наших партнёров

📌 Как участвовать:
1️⃣ Посетите каждый ресторан — Uzbekona, Dolcetta, Resto — и сделайте в нём заказ на сумму не менее 300 000 сум, чтобы получить билет. Каждый ресторан выдаёт свои билеты, и для участия необходимо собрать хотя бы один билет с каждого заведения.

2️⃣ Общая сумма билетов для участия в розыгрыше должна быть не менее 10. Все билеты нужно активировать в соответствующем Telegram-боте каждого ресторана: сначала зарегистрируйтесь в боте, затем отсканируйте QR-код с билета. В розыгрыше участвуют только активированные билеты.

3️⃣ Чем больше билетов вы активируете, тем выше ваши шансы на победу.

Приходите за любимыми вкусами — возможно, именно ваш визит станет счастливым.`;

  private readonly PROMO_TEXT_UZ = `🎁 Avtomobil o'yini 

Do'stlar, Forthing S7 avtomobilini o'yin qilamiz!
Uzbekona, Dolcetta va Resto restoranlari Pepsi, Grace Travel va Forthing bilan birga katta aksiyani boshlayapti.

🎁 Asosiy sovrin bilan birga sizni kutayapti:
• Dubayga juftlik sayohat
• Misrga juftlik sayohat
• 2 ta iPhone 17 Pro Max
• Hamkorlarimizdan sertifikatlar

📌 Qanday qatnashish:
1️⃣ Har bir restoronga — Uzbekona, Dolcetta, Resto — tashrif buyuring va kamida 300 000 so'm buyurtma bering, bilet olish uchun. Har bir restoran o'z biletlarini beradi, ishtirok etish uchun har bir muassasadan kamida bitta bilet yig'ish kerak.

2️⃣ O'yinda qatnashish uchun biletlar yig'indisi kamida 10 bo'lishi kerak. Barcha biletlarni har bir restoronga tegishli Telegram-botda faollashtirish kerak: avval botda ro'yxatdan o'ting, keyin biletdagi QR-kodni skanerlang. O'yinda faqat faollashtirilgan biletlar qatnashadi.

3️⃣ Qancha ko'p bilet faollashtirsangiz, g'alaba qozonish imkoniyatingiz shunchalik yuqori.

Sevimli taomlar uchun keling — ehtimol, aynan sizning tashrifingiz baxtli bo'ladi.`;

  private async handlePromo(ctx: Context) {
    const chatId = ctx.from!.id.toString();
    const reg = await this.requireRegistration(ctx, chatId);
    if (!reg.ok) return;
    const user = await this.usersService.findOrCreateByChatId(chatId);
    const lang = reg.lang || user.botLanguage || 'RU';
    const campaign = await this.campaignsService.getActive();

    if (!campaign) {
      await ctx.reply(lang === 'UZ' ? '😔 Hozirda faol aksiya yo\'q.' : '😔 Сейчас нет активных акций.');
      return;
    }

    const text = lang === 'UZ' ? this.PROMO_TEXT_UZ : this.PROMO_TEXT_RU;
    await ctx.reply(text);
  }

  // ── Меню (Mini App) ──

  private async handleMenu(ctx: Context, bot: BotInstance) {
    const chatId = ctx.from!.id.toString();
    const reg = await this.requireRegistration(ctx, chatId);
    if (!reg.ok) return;
    const user = await this.usersService.findOrCreateByChatId(chatId);
    const lang = reg.lang || user.botLanguage || 'RU';

    if (bot.miniAppUrl) {
      const btnText = lang === 'UZ' ? '📋 Menyuni ochish' : '📋 Открыть меню';
      await ctx.reply(
        lang === 'UZ' ? 'Menyuni ochish uchun pastdagi tugmani bosing:' : 'Нажмите кнопку ниже, чтобы открыть меню:',
        Markup.inlineKeyboard([
          Markup.button.webApp(btnText, bot.miniAppUrl),
        ]),
      );
    } else {
      await ctx.reply(lang === 'UZ' ? '📋 Menyu tez orada ishga tushadi!' : '📋 Меню скоро будет доступно!');
    }
  }

  // ── Язык ──

  private async handleLanguage(ctx: Context) {
    await ctx.reply(
      '🌐 Выберите язык / Tilni tanlang:',
      Markup.inlineKeyboard([
        Markup.button.callback('🇷🇺 Русский', 'lang_RU'),
        Markup.button.callback('🇺🇿 O\'zbekcha', 'lang_UZ'),
      ]),
    );
  }

  // ── Контакты ──

  private getContactsForBot(botName: string, lang: string): string {
    const contacts: Record<string, { name: string; address: string; phone: string; instagram: string }> = {
      resto: {
        name: 'Resto',
        address: '📍ул. Матбуотчилар 1, (ТЦ Poytaxt)',
        phone: '55 514 11 11',
        instagram: 'https://www.instagram.com/resto.tashkent?igsh=cmdqZG53dXlvdW14&utm_source=qr',
      },
      uzbekona: {
        name: 'Uzbekona',
        address: '📍ул. Матбуотчилар 1/2, (ТЦ Poytaxt)',
        phone: '55 055 44 44',
        instagram: 'https://www.instagram.com/uzbekona.restaurant?igsh=MWJkYjN6ZW1ibnU2YQ%3D%3D&utm_source=qr',
      },
      dolcetta: {
        name: 'Dolcetta',
        address: '📍ул. Матбуотчилар 1/1, (ТЦ Poytaxt)',
        phone: '55 055 11 11',
        instagram: 'https://www.instagram.com/dolcetta.uz?igsh=cmM5NWZnemp3NnZ0&utm_source=qr',
      },
    };
    const key = botName.toLowerCase();
    const c = contacts[key] || contacts.resto;
    if (lang === 'UZ') {
      return `📞 ${c.name} kontaktlari\n\n🏢 ${c.name}\n${c.address}\n\n📱 ${c.phone}\n\n📸 Instagram:\n${c.instagram}`;
    }
    return `📞 Контакты ${c.name}\n\n🏢 ${c.name}\n${c.address}\n\n📱 ${c.phone}\n\n📸 Instagram:\n${c.instagram}`;
  }

  private async handleContacts(ctx: Context, bot: BotInstance) {
    const chatId = ctx.from!.id.toString();
    const user = await this.usersService.findOrCreateByChatId(chatId);
    const lang = user.botLanguage || 'RU';
    const msg = this.getContactsForBot(bot.name, lang);
    await ctx.reply(msg);
  }

  // ── Загрузка чека ──

  private async handleReceiptRequest(ctx: Context, bot: BotInstance) {
    const chatId = ctx.from!.id.toString();
    const reg = await this.requireRegistration(ctx, chatId);
    if (!reg.ok) return;

    const user = await this.usersService.findOrCreateByChatId(chatId);
    const lang = user.botLanguage || 'RU';

    await this.usersService.updateBotStep(chatId, 'AWAITING_RECEIPT');
    await ctx.reply(
      lang === 'UZ'
        ? '📷 Chek rasmini yuboring (foto)'
        : '📷 Отправьте фото чека',
    );
  }

  private async handleReceiptPhoto(ctx: Context, bot: BotInstance) {
    const chatId = ctx.from!.id.toString();
    const user = await this.usersService.findOrCreateByChatId(chatId);

    if (user.botStep !== 'AWAITING_RECEIPT') return;

    const photo = (ctx.message as any)?.photo;
    if (!photo || !Array.isArray(photo) || photo.length === 0) return;

    const fileId = photo[photo.length - 1].file_id;

    await this.prisma.receiptPhoto.create({
      data: { userId: user.id, fileId, botId: bot.id },
    });

    await this.usersService.updateBotStep(chatId, 'REGISTERED');

    const lang = user.botLanguage || 'RU';
    await ctx.reply(
      lang === 'UZ' ? '✅ Chek qabul qilindi!' : '✅ Чек принят!',
      this.getMainKeyboard(lang),
    );
  }

  // ── Контакт ──

  private async handleContact(ctx: Context) {
    const contact = (ctx.message as any)?.contact;
    if (!contact) return;

    const chatId = ctx.from!.id.toString();
    const phone = contact.phone_number;
    const name = ctx.from?.first_name || undefined;

    try {
      const user = await this.usersService.updatePhone(chatId, phone);
      await this.usersService.updateBotStep(chatId, 'REGISTERED');

      const lang = user.botLanguage || 'RU';

      if (user.pendingVoucherCode) {
        await this.activateVoucherForUser(ctx, chatId, user.pendingVoucherCode, name, phone);
        await this.usersService.clearPendingVoucherCode(chatId);
        await this.sendMainMenu(ctx, lang);
      } else {
        await ctx.reply(
          lang === 'UZ' ? '✅ Raqamingiz saqlandi!' : '✅ Номер сохранён!',
          this.getMainKeyboard(lang),
        );
      }
    } catch (e) {
      this.logger.error('Error saving contact', e);
      await ctx.reply('Произошла ошибка при сохранении номера.');
    }
  }

  // ── Клавиатура ──

  private getMainKeyboard(lang: string) {
    if (lang === 'UZ') {
      return Markup.keyboard([
        ['📋 Menyu', '👤 Profil'],
        ['🎁 Aksiya', '📷 Chek yuklash'],
        ['📞 Kontaktlar', '🌐 Til'],
      ]).resize();
    }
    return Markup.keyboard([
      ['📋 Меню', '👤 Профиль'],
      ['🎁 Акция', '📷 Загрузить чек'],
      ['📞 Контакты', '🌐 Язык'],
    ]).resize();
  }

  private async sendMainMenu(ctx: Context, lang: string) {
    await ctx.reply(
      lang === 'UZ' ? 'Tanlang:' : 'Выберите действие:',
      this.getMainKeyboard(lang),
    );
  }
}
