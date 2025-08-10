const { Client } = require("discord.js-selfbot-v13");
require("dotenv").config();

class MessageCleaner {
  constructor() {
    this.client = new Client();
    this.rateLimit = parseInt(process.env.RATE_LIMIT_DELAY) || 1500;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.on("ready", () => {
      console.log(`✅ Giriş yapıldı: ${this.client.user.tag}`);
      console.log("⚠️  UYARI: Selfbot kullanımı Discord ToS'a aykırıdır!");
    });

    this.client.on("error", (error) => {
      console.error("❌ Hata:", error);
    });
  }

  async login() {
    try {
      await this.client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
      console.error("❌ Giriş hatası:", error.message);
      process.exit(1);
    }
  }

  async cleanMessages(channelId, options = {}) {
    const {
      limit = null,
      olderThan = null,
      contentFilter = null,
      keywords = null,
      dryRun = false,
    } = options;

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel) {
        throw new Error("Kanal bulunamadı!");
      }

      const limitText = limit ? `${limit} mesaj` : "TÜM MESAJLAR";
      console.log(
        `🧹 Mesaj temizleme başlatılıyor: ${
          channel.name || "DM"
        } - ${limitText}`
      );

      if (!limit) {
        console.log(
          "⚠️  UYARI: TÜM MESAJLAR SİLİNECEK! Bu işlem geri alınamaz!"
        );
        console.log("⏳ 5 saniye bekleniyor... İptal etmek için Ctrl+C");
        await this.sleep(5000);
      }

      const messages = await this.fetchMessages(channel, limit, olderThan);
      const allMessagesArray = Array.from(messages.values());
      const myMessages = allMessagesArray.filter(
        (msg) => msg.author.id === this.client.user.id
      );

      let filteredMessages = myMessages;

      if (contentFilter) {
        filteredMessages = filteredMessages.filter((msg) =>
          msg.content.toLowerCase().includes(contentFilter.toLowerCase())
        );
      }

      if (keywords && keywords.length > 0) {
        filteredMessages = filteredMessages.filter((msg) => {
          const messageContent = msg.content.toLowerCase();
          return keywords.some((keyword) =>
            messageContent.includes(keyword.toLowerCase())
          );
        });
      }

      console.log(`📊 Toplam mesaj: ${messages.size}`);
      console.log(`📊 Kendi mesajlarım: ${myMessages.length}`);
      console.log(`📊 Silinecek mesaj: ${filteredMessages.length}`);

      if (dryRun) {
        console.log("� Ddry run modu - mesajlar silinmeyecek");
        return filteredMessages.length;
      }

      return await this.deleteMessages(filteredMessages);
    } catch (error) {
      console.error("❌ Temizleme hatası:", error.message);
      return 0;
    }
  }

  async fetchMessages(channel, limit, olderThan) {
    const messages = new Map();
    let lastMessageId = null;
    let fetchedCount = 0;
    let totalFetched = 0;

    console.log("📥 Mesajlar getiriliyor...");

    while (true) {
      if (limit && fetchedCount >= limit) break;

      const fetchLimit = limit ? Math.min(100, limit - fetchedCount) : 100;
      const options = { limit: fetchLimit };

      if (lastMessageId) {
        options.before = lastMessageId;
      }

      const batch = await channel.messages.fetch(options);
      if (batch.size === 0) {
        console.log("📭 Daha fazla mesaj bulunamadı");
        break;
      }

      for (const [id, message] of batch) {
        if (olderThan && message.createdTimestamp > olderThan) {
          continue;
        }
        messages.set(id, message);
        fetchedCount++;
        totalFetched++;

        if (totalFetched % 100 === 0) {
          console.log(`📊 ${totalFetched} mesaj getirildi...`);
        }

        if (limit && fetchedCount >= limit) break;
      }

      lastMessageId = batch.last()?.id;
      await this.sleep(200);
    }

    console.log(`✅ Toplam ${totalFetched} mesaj getirildi`);
    return messages;
  }

  // Discord arama API'sini kullanarak hızlı arama
  async searchMyMessages(channel, limit = null, contentFilter = null) {
    const myMessages = [];
    let offset = 0;
    const searchLimit = 25;

    console.log("🔍 Arama API'si ile kendi mesajlar aranıyor...");

    try {
      while (true) {
        if (limit && myMessages.length >= limit) break;

        // REST API ile arama yap
        const response = await this.client.api
          .guilds(channel.guild.id)
          .messages.search.get({
            query: {
              author_id: this.client.user.id,
              channel_id: channel.id,
              content: contentFilter || undefined,
              offset: offset,
              limit: searchLimit,
            },
          });

        if (!response || !response.messages || response.messages.length === 0) {
          console.log("🔍 Daha fazla mesaj bulunamadı");
          break;
        }

        for (const messageGroup of response.messages) {
          for (const messageData of messageGroup) {
            if (messageData.author.id === this.client.user.id) {
              // Message objesini oluştur
              const message =
                channel.messages.cache.get(messageData.id) ||
                (await channel.messages
                  .fetch(messageData.id)
                  .catch(() => null));

              if (message) {
                myMessages.push(message);
                if (limit && myMessages.length >= limit) break;
              }
            }
          }
          if (limit && myMessages.length >= limit) break;
        }

        offset += searchLimit;
        console.log(`📊 ${myMessages.length} kendi mesaj bulundu...`);
        await this.sleep(1000);
      }
    } catch (error) {
      console.log(
        "⚠️  Arama API'si kullanılamadı, geleneksel yönteme geçiliyor..."
      );
      console.log("❌ Arama hatası:", error.message);
      return null;
    }

    console.log(`✅ Toplam ${myMessages.length} kendi mesaj bulundu`);
    return myMessages;
  }

  async cleanMessagesWithSearch(channelId, options = {}) {
    const { limit = null, contentFilter = null, dryRun = false } = options;

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel) {
        throw new Error("Kanal bulunamadı!");
      }

      if (!channel.guild) {
        console.log("⚠️  DM kanalı - geleneksel yöntem kullanılacak");
        return await this.cleanMessages(channelId, options);
      }

      const limitText = limit ? `${limit} mesaj` : "TÜM MESAJLAR";
      console.log(
        `🧹 Hızlı arama ile temizleme: ${channel.name} - ${limitText}`
      );

      if (!limit) {
        console.log("⚠️  UYARI: TÜM MESAJLAR SİLİNECEK!");
        console.log("⏳ 5 saniye bekleniyor...");
        await this.sleep(5000);
      }

      const myMessages = await this.searchMyMessages(
        channel,
        limit,
        contentFilter
      );

      if (!myMessages) {
        console.log("🔄 Geleneksel yönteme geçiliyor...");
        return await this.cleanMessages(channelId, options);
      }

      console.log(`📊 Silinecek mesaj: ${myMessages.length}`);

      if (dryRun) {
        console.log("🔍 Dry run modu - mesajlar silinmeyecek");
        return myMessages.length;
      }

      return await this.deleteMessages(myMessages);
    } catch (error) {
      console.error("❌ Hızlı temizleme hatası:", error.message);
      console.log("🔄 Geleneksel yönteme geçiliyor...");
      return await this.cleanMessages(channelId, options);
    }
  }

  async deleteMessages(messages) {
    let deletedCount = 0;
    const totalMessages = messages.length;

    console.log(`🗑️  ${totalMessages} mesaj silinmeye başlanıyor...`);

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      try {
        await message.delete();
        deletedCount++;

        if (deletedCount % 10 === 0 || deletedCount === totalMessages) {
          console.log(
            `🗑️  İlerleme: ${deletedCount}/${totalMessages} mesaj silindi`
          );
        }

        await this.sleep(this.rateLimit);
      } catch (error) {
        console.error(`❌ Mesaj silinemedi: ${error.message}`);

        if (error.code === 50013) {
          console.log("⚠️  Yetki hatası - devam ediliyor...");
        } else if (error.code === 429) {
          console.log("⚠️  Rate limit - 10 saniye bekleniyor...");
          await this.sleep(10000);
        } else if (error.code === 10008) {
          console.log("⚠️  Mesaj bulunamadı - devam ediliyor...");
        }
      }
    }

    console.log(`✅ Toplam ${deletedCount}/${totalMessages} mesaj silindi`);
    return deletedCount;
  }

  async cleanDM(userId, options = {}) {
    try {
      const user = await this.client.users.fetch(userId);
      const dmChannel = await user.createDM();
      return await this.cleanMessages(dmChannel.id, options);
    } catch (error) {
      console.error("❌ DM temizleme hatası:", error.message);
      return 0;
    }
  }

  async cleanAllMessages(channelId, options = {}) {
    return await this.cleanMessages(channelId, { ...options, limit: null });
  }

  async cleanAllDM(userId, options = {}) {
    return await this.cleanDM(userId, { ...options, limit: null });
  }

  async cleanAllServers(options = {}) {
    const { keywords = [], dryRun = false, limit = null } = options;

    if (!keywords || keywords.length === 0) {
      console.error("❌ Kelime listesi gerekli!");
      return 0;
    }

    console.log(
      `🌐 Tüm sunucularda HIZLI kelime bazlı temizleme başlatılıyor...`
    );
    console.log(`🔍 Aranacak kelimeler: ${keywords.join(", ")}`);

    if (!dryRun) {
      console.log("⚠️  UYARI: TÜM SUNUCULARDA MESAJLAR SİLİNECEK!");
      console.log("⏳ 10 saniye bekleniyor... İptal etmek için Ctrl+C");
      await this.sleep(10000);
    }

    let totalDeleted = 0;
    const guilds = this.client.guilds.cache;

    console.log(`📊 ${guilds.size} sunucu bulundu`);

    for (const [guildId, guild] of guilds) {
      try {
        console.log(`\n🏰 Sunucu: ${guild.name}`);

        const channels = guild.channels.cache.filter((channel) => {
          // Metin kanalı kontrolü (discord.js-selfbot-v13 uyumlu)
          const isTextChannel =
            channel.type === 0 || // GUILD_TEXT
            channel.type === "GUILD_TEXT" ||
            channel.type === 5 || // GUILD_NEWS
            channel.type === "GUILD_NEWS" ||
            channel.type === 11 || // GUILD_NEWS_THREAD
            channel.type === 12; // GUILD_PUBLIC_THREAD

          return (
            isTextChannel &&
            channel.permissionsFor(this.client.user)?.has("ViewChannel")
          );
        });

        console.log(`📝 ${channels.size} metin kanalı bulundu`);

        for (const [channelId, channel] of channels) {
          try {
            console.log(`  📂 Kanal: ${channel.name}`);

            // Hızlı kelime araması kullan
            const deleted = await this.cleanKeywordsInChannel(
              channelId,
              keywords,
              {
                limit,
                dryRun,
              }
            );

            totalDeleted += deleted;
            await this.sleep(3000); // Kanallar arası daha uzun bekleme
          } catch (error) {
            console.error(
              `    ❌ Kanal hatası (${channel.name}): ${error.message}`
            );
          }
        }

        await this.sleep(5000);
      } catch (error) {
        console.error(`❌ Sunucu hatası (${guild.name}): ${error.message}`);
      }
    }

    console.log(`\n✅ Tüm sunucularda toplam ${totalDeleted} mesaj silindi`);
    return totalDeleted;
  }

  async cleanKeywordsInChannel(channelId, keywords, options = {}) {
    if (!keywords || keywords.length === 0) {
      console.error("❌ Kelime listesi gerekli!");
      return 0;
    }

    console.log(`🔍 Kelime bazlı hızlı temizleme: ${keywords.join(", ")}`);

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel) {
        throw new Error("Kanal bulunamadı!");
      }

      if (!channel.guild) {
        console.log("⚠️  DM kanalı - geleneksel yöntem kullanılacak");
        return await this.cleanMessages(channelId, { ...options, keywords });
      }

      let allFoundMessages = [];

      // Her kelime için ayrı arama yap
      for (const keyword of keywords) {
        console.log(`🔍 "${keyword}" kelimesi aranıyor...`);

        const foundMessages = await this.searchMyMessages(
          channel,
          options.limit,
          keyword
        );

        if (foundMessages && foundMessages.length > 0) {
          // Duplicate mesajları önle
          const newMessages = foundMessages.filter(
            (msg) =>
              !allFoundMessages.some((existing) => existing.id === msg.id)
          );
          allFoundMessages.push(...newMessages);
          console.log(
            `✅ "${keyword}" için ${newMessages.length} yeni mesaj bulundu`
          );
        }

        await this.sleep(1000); // Kelimeler arası bekleme
      }

      console.log(
        `📊 Toplam ${allFoundMessages.length} benzersiz mesaj bulundu`
      );

      if (options.dryRun) {
        console.log("🔍 Dry run modu - mesajlar silinmeyecek");
        return allFoundMessages.length;
      }

      return await this.deleteMessages(allFoundMessages);
    } catch (error) {
      console.error("❌ Hızlı kelime araması hatası:", error.message);
      console.log("🔄 Geleneksel yönteme geçiliyor...");
      return await this.cleanMessages(channelId, { ...options, keywords });
    }
  }

  async cleanKeywordsInDM(userId, keywords, options = {}) {
    if (!keywords || keywords.length === 0) {
      console.error("❌ Kelime listesi gerekli!");
      return 0;
    }

    console.log(`🔍 DM'de kelime bazlı temizleme: ${keywords.join(", ")}`);
    console.log(
      `⚠️  DM'lerde arama API'si kullanılamaz - geleneksel yöntem kullanılacak`
    );

    return await this.cleanDM(userId, {
      ...options,
      keywords,
    });
  }

  async cleanKeywordsInServer(guildId, keywords, options = {}) {
    if (!keywords || keywords.length === 0) {
      console.error("❌ Kelime listesi gerekli!");
      return 0;
    }

    const { dryRun = false, limit = null } = options;

    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        throw new Error("Sunucu bulunamadı!");
      }

      console.log(`🏰 Sunucu bazlı HIZLI kelime araması: ${guild.name}`);
      console.log(`🔍 Aranacak kelimeler: ${keywords.join(", ")}`);

      if (!dryRun) {
        console.log("⚠️  UYARI: SUNUCUDAKI TÜM KANALLARDA MESAJLAR SİLİNECEK!");
        console.log("⏳ 5 saniye bekleniyor... İptal etmek için Ctrl+C");
        await this.sleep(5000);
      }

      const channels = guild.channels.cache.filter((channel) => {
        // Metin kanalı kontrolü (discord.js-selfbot-v13 uyumlu)
        const isTextChannel =
          channel.type === 0 || // GUILD_TEXT
          channel.type === "GUILD_TEXT" ||
          channel.type === 5 || // GUILD_NEWS
          channel.type === "GUILD_NEWS" ||
          channel.type === 11 || // GUILD_NEWS_THREAD
          channel.type === 12; // GUILD_PUBLIC_THREAD

        return (
          isTextChannel &&
          channel.permissionsFor(this.client.user)?.has("ViewChannel")
        );
      });

      console.log(`📝 ${channels.size} metin kanalı bulundu`);

      let totalDeleted = 0;

      for (const [channelId, channel] of channels) {
        try {
          console.log(`\n📂 Kanal: ${channel.name}`);

          const deleted = await this.cleanKeywordsInChannel(
            channelId,
            keywords,
            {
              limit,
              dryRun,
            }
          );

          totalDeleted += deleted;
          console.log(`✅ ${channel.name}: ${deleted} mesaj silindi`);

          // Kanallar arası bekleme
          await this.sleep(2000);
        } catch (error) {
          console.error(`❌ Kanal hatası (${channel.name}): ${error.message}`);
        }
      }

      console.log(
        `\n🎉 ${guild.name} sunucusunda toplam ${totalDeleted} mesaj silindi`
      );
      return totalDeleted;
    } catch (error) {
      console.error("❌ Sunucu bazlı temizleme hatası:", error.message);
      return 0;
    }
  }

  async cleanKeywordsInServerFast(guildId, keywords, options = {}) {
    return await this.cleanKeywordsInServer(guildId, keywords, options);
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Ana fonksiyon
async function main() {
  const cleaner = new MessageCleaner();
  await cleaner.login();

  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "clean-channel":
      const channelId = args[1] || process.env.CHANNEL_ID;
      if (!channelId) {
        console.error("❌ Kanal ID gerekli!");
        process.exit(1);
      }
      const channelLimit = args[2] ? parseInt(args[2]) : null;
      await cleaner.cleanMessages(channelId, {
        limit: channelLimit,
        dryRun: args.includes("--dry-run"),
      });
      break;

    case "clean-channel-fast":
      const fastChannelId = args[1] || process.env.CHANNEL_ID;
      if (!fastChannelId) {
        console.error("❌ Kanal ID gerekli!");
        process.exit(1);
      }
      const fastChannelLimit = args[2] ? parseInt(args[2]) : null;
      await cleaner.cleanMessagesWithSearch(fastChannelId, {
        limit: fastChannelLimit,
        dryRun: args.includes("--dry-run"),
      });
      break;

    case "clean-all-channel":
      const allChannelId = args[1] || process.env.CHANNEL_ID;
      if (!allChannelId) {
        console.error("❌ Kanal ID gerekli!");
        process.exit(1);
      }
      await cleaner.cleanAllMessages(allChannelId, {
        dryRun: args.includes("--dry-run"),
      });
      break;

    case "clean-dm":
      const userId = args[1];
      if (!userId) {
        console.error("❌ Kullanıcı ID gerekli!");
        process.exit(1);
      }
      const dmLimit = args[2] ? parseInt(args[2]) : null;
      await cleaner.cleanDM(userId, {
        limit: dmLimit,
        dryRun: args.includes("--dry-run"),
      });
      break;

    case "clean-all-dm":
      const allUserId = args[1];
      if (!allUserId) {
        console.error("❌ Kullanıcı ID gerekli!");
        process.exit(1);
      }
      await cleaner.cleanAllDM(allUserId, {
        dryRun: args.includes("--dry-run"),
      });
      break;

    case "clean-keywords":
      const keywordChannelId = args[1] || process.env.CHANNEL_ID;
      const keywords = args.slice(2).filter((arg) => !arg.startsWith("--"));
      if (!keywordChannelId || keywords.length === 0) {
        console.error("❌ Kanal ID ve en az bir kelime gerekli!");
        console.error(
          "Örnek: node index.js clean-keywords 123456789 kelime1 kelime2"
        );
        process.exit(1);
      }
      await cleaner.cleanKeywordsInChannel(keywordChannelId, keywords, {
        dryRun: args.includes("--dry-run"),
      });
      break;

    case "clean-keywords-fast":
      const fastKeywordChannelId = args[1] || process.env.CHANNEL_ID;
      const fastKeywords = args.slice(2).filter((arg) => !arg.startsWith("--"));
      if (!fastKeywordChannelId || fastKeywords.length === 0) {
        console.error("❌ Kanal ID ve en az bir kelime gerekli!");
        console.error(
          "Örnek: node index.js clean-keywords-fast 123456789 kelime1 kelime2"
        );
        process.exit(1);
      }
      await cleaner.cleanKeywordsInChannel(fastKeywordChannelId, fastKeywords, {
        dryRun: args.includes("--dry-run"),
      });
      break;

    case "clean-keywords-dm":
      const keywordUserId = args[1];
      const dmKeywords = args.slice(2).filter((arg) => !arg.startsWith("--"));
      if (!keywordUserId || dmKeywords.length === 0) {
        console.error("❌ Kullanıcı ID ve en az bir kelime gerekli!");
        console.error(
          "Örnek: node index.js clean-keywords-dm 123456789 kelime1 kelime2"
        );
        process.exit(1);
      }
      await cleaner.cleanKeywordsInDM(keywordUserId, dmKeywords, {
        dryRun: args.includes("--dry-run"),
      });
      break;

    case "clean-server":
      const serverId = args[1];
      const serverKeywords = args
        .slice(2)
        .filter((arg) => !arg.startsWith("--"));
      if (!serverId || serverKeywords.length === 0) {
        console.error("❌ Sunucu ID ve en az bir kelime gerekli!");
        console.error(
          "Örnek: node index.js clean-server 123456789 kelime1 kelime2"
        );
        process.exit(1);
      }
      await cleaner.cleanKeywordsInServer(serverId, serverKeywords, {
        dryRun: args.includes("--dry-run"),
      });
      break;

    case "clean-server-fast":
      const fastServerId = args[1];
      const fastServerKeywords = args
        .slice(2)
        .filter((arg) => !arg.startsWith("--"));
      if (!fastServerId || fastServerKeywords.length === 0) {
        console.error("❌ Sunucu ID ve en az bir kelime gerekli!");
        console.error(
          "Örnek: node index.js clean-server-fast 123456789 kelime1 kelime2"
        );
        process.exit(1);
      }
      await cleaner.cleanKeywordsInServerFast(
        fastServerId,
        fastServerKeywords,
        {
          dryRun: args.includes("--dry-run"),
        }
      );
      break;

    case "clean-all-servers":
      const allServerKeywords = args
        .slice(1)
        .filter((arg) => !arg.startsWith("--"));
      if (allServerKeywords.length === 0) {
        console.error("❌ En az bir kelime gerekli!");
        console.error("Örnek: node index.js clean-all-servers kelime1 kelime2");
        process.exit(1);
      }
      await cleaner.cleanAllServers({
        keywords: allServerKeywords,
        dryRun: args.includes("--dry-run"),
      });
      break;

    default:
      console.log(`
📖 Kullanım:
  node index.js clean-channel <channel_id> [limit] [--dry-run]
  node index.js clean-channel-fast <channel_id> [limit] [--dry-run]  # HIZLI ARAMA
  node index.js clean-all-channel <channel_id> [--dry-run]
  node index.js clean-dm <user_id> [limit] [--dry-run]  
  node index.js clean-all-dm <user_id> [--dry-run]
  node index.js clean-keywords <channel_id> <kelime1> [kelime2] ... [--dry-run]
  node index.js clean-keywords-fast <channel_id> <kelime1> [kelime2] ... [--dry-run]  # HIZLI
  node index.js clean-keywords-dm <user_id> <kelime1> [kelime2] ... [--dry-run]
  node index.js clean-server <server_id> <kelime1> [kelime2] ... [--dry-run]  # TEK SUNUCU
  node index.js clean-server-fast <server_id> <kelime1> [kelime2] ... [--dry-run]  # TEK SUNUCU HIZLI
  node index.js clean-all-servers <kelime1> [kelime2] ... [--dry-run]

📝 Örnekler:
  node index.js clean-channel-fast 123456789012345678 50     # HIZLI - Arama API
  node index.js clean-channel 123456789012345678 50          # YAVAS - Tüm mesajları çek
  node index.js clean-channel 123456789012345678             # Tüm mesajlar
  node index.js clean-all-channel 123456789012345678         # Tüm mesajlar (açık)
  node index.js clean-dm 987654321098765432 100
  node index.js clean-dm 987654321098765432                  # Tüm mesajlar
  node index.js clean-all-dm 987654321098765432 --dry-run
  
🔍 Kelime bazlı silme:
  node index.js clean-keywords-fast 123456789 "spam" "reklam"        # TEK KANAL HIZLI
  node index.js clean-keywords 123456789 "kötü kelime" spam          # TEK KANAL YAVAS
  node index.js clean-keywords-dm 987654321 "silinecek" test --dry-run
  node index.js clean-server-fast 987654321098765432 "spam" "reklam" # TEK SUNUCU HIZLI
  node index.js clean-server 987654321098765432 "spam" "reklam"      # TEK SUNUCU
  node index.js clean-all-servers "spam" "reklam" "kötü" --dry-run   # TÜM SUNUCULAR

⚠️  Limit belirtilmezse TÜM MESAJLAR silinir!
🚀 HIZLI: clean-channel-fast komutu Discord arama API'sini kullanır (çok daha hızlı)
🏰 SUNUCU: clean-server-fast tek sunucudaki tüm kanallarda hızlı arama yapar
⚠️  clean-all-servers TÜM SUNUCULARDA çalışır - çok dikkatli kullanın!
            `);
  }

  process.exit(0);
}

// Hata yakalama
process.on("unhandledRejection", (error) => {
  console.error("❌ İşlenmeyen hata:", error);
});

if (require.main === module) {
  main();
}

module.exports = MessageCleaner;
