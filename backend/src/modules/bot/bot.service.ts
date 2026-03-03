import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
  ) {}

  async onModuleInit() {
    setImmediate(() => {
      this.launchAllBots().catch((e) =>
        this.logger.error('Failed to launch bots on startup', e),
      );
    });
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

  async launchBot(dbBot: { id: number; name: string; token: string; username: string; brandId: number | null; miniAppUrl: string | null }) {
    if (this.bots.has(dbBot.id)) {
      this.logger.warn(`Bot "${dbBot.name}" already running, skipping`);
      return;
    }

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
        setTimeout(() => reject(new Error('Launch timeout')), 15000),
      );
      await Promise.race([launchPromise, timeout]);

      this.bots.set(dbBot.id, instance);
      this.logger.log(`Bot "${dbBot.name}" (@${dbBot.username}) started`);
    } catch (e: any) {
      this.logger.error(`Failed to start bot "${dbBot.name}": ${e.message}`);
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
    const dbBot = await this.prisma.telegramBot.findUnique({ where: { id: botId } });
    if (dbBot && dbBot.isActive) {
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
    let instance: BotInstance | undefined;
    if (botId) {
      instance = this.bots.get(botId);
    }
    if (!instance) {
      instance = this.bots.values().next().value;
    }
    if (!instance) return null;

    try {
      const link = await instance.telegraf.telegram.getFileLink(fileId);
      const res = await fetch(link.href);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      return Buffer.from(arr);
    } catch (e) {
      this.logger.error(`Failed to get file ${fileId}: ${(e as Error).message}`);
      return null;
    }
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

    const startDate = new Date(campaign.startDate).toLocaleDateString(lang === 'UZ' ? 'uz-UZ' : 'ru-RU');
    const endDate = new Date(campaign.endDate).toLocaleDateString(lang === 'UZ' ? 'uz-UZ' : 'ru-RU');
    const sum = campaign.sumPerVoucher.toLocaleString('ru-RU');

    if (lang === 'UZ') {
      await ctx.reply(
        `🎁 ${campaign.title}\n\n${campaign.description || ''}\n\n📅 Muddat: ${startDate} — ${endDate}\n\n📌 Shartlar:\n• Har ${sum} so'm xarid uchun — 1 kupon\n• Kamida ${campaign.minVouchers} ta kupon to'plang\n• Kamida ${campaign.minBrands} ta brenddan kupon bo'lishi kerak\n\n🏆 Barcha shartlarni bajarganlar katta sovrin o'yinida ishtirok etadi!`,
      );
    } else {
      await ctx.reply(
        `🎁 ${campaign.title}\n\n${campaign.description || ''}\n\n📅 Сроки: ${startDate} — ${endDate}\n\n📌 Условия участия:\n• За каждые ${sum} сум покупки — 1 купон\n• Соберите минимум ${campaign.minVouchers} купонов\n• Купоны должны быть минимум от ${campaign.minBrands} брендов\n\n🏆 Выполнившие все условия участвуют в розыгрыше главного приза!`,
      );
    }
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

  private async handleContacts(ctx: Context, bot: BotInstance) {
    const chatId = ctx.from!.id.toString();
    const user = await this.usersService.findOrCreateByChatId(chatId);
    const lang = user.botLanguage || 'RU';
    const msg = lang === 'UZ'
      ? `📞 Kontaktlar\n\nAksiya bo'yicha savollar uchun tashkilotchilarga murojaat qiling.`
      : `📞 Контакты\n\nПо вопросам акции обращайтесь к организаторам.`;
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

    try {
      await this.usersService.updatePhone(chatId, phone);
      await this.usersService.updateBotStep(chatId, 'REGISTERED');

      const user = await this.usersService.findOrCreateByChatId(chatId);
      const lang = user.botLanguage || 'RU';

      await ctx.reply(
        lang === 'UZ' ? '✅ Raqamingiz saqlandi!' : '✅ Номер сохранён!',
        this.getMainKeyboard(lang),
      );
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
