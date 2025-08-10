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
      limit = null, // null = tüm mesajlar
      olderThan = null,
      contentFilter = null,
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

      // Map'i array'e çevir ve sadece kendi mesajlarını filtrele
      const allMessagesArray = Array.from(messages.values());
      const myMessages = allMessagesArray.filter(
        (msg) => msg.author.id === this.client.user.id
      );

      let filteredMessages = myMessages;
      if (contentFilter) {
        filteredMessages = myMessages.filter((msg) =>
          msg.content.toLowerCase().includes(contentFilter.toLowerCase())
        );
      }

      console.log(`📊 Toplam mesaj: ${messages.size}`);
      console.log(`📊 Kendi mesajlarım: ${myMessages.length}`);
      console.log(`📊 Silinecek mesaj: ${filteredMessages.length}`);

      if (dryRun) {
        console.log("🔍 Dry run modu - mesajlar silinmeyecek");
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
      // Limit varsa ve ulaştıysak dur
      if (limit && fetchedCount >= limit) break;

      // Batch boyutunu belirle
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

        // Progress göster
        if (totalFetched % 100 === 0) {
          console.log(`📊 ${totalFetched} mesaj getirildi...`);
        }

        if (limit && fetchedCount >= limit) break;
      }

      lastMessageId = batch.last()?.id;

      // Rate limiting
      await this.sleep(200);
    }

    console.log(`✅ Toplam ${totalFetched} mesaj getirildi`);
    return messages;
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

        // Progress göster
        if (deletedCount % 10 === 0 || deletedCount === totalMessages) {
          console.log(
            `🗑️  İlerleme: ${deletedCount}/${totalMessages} mesaj silindi`
          );
        }

        // Rate limiting - önemli!
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

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Kullanım örneği
async function main() {
  const cleaner = new MessageCleaner();
  await cleaner.login();

  // Komut satırı argümanları
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "clean-channel":
      const channelId = args[1] || process.env.CHANNEL_ID;
      if (!channelId) {
        console.error("❌ Kanal ID gerekli!");
        process.exit(1);
      }
      const channelLimit = args[2] ? parseInt(args[2]) : null; // Limit belirtilmezse null
      await cleaner.cleanMessages(channelId, {
        limit: channelLimit,
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
      const dmLimit = args[2] ? parseInt(args[2]) : null; // Limit belirtilmezse null
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

    default:
      console.log(`
📖 Kullanım:
  node index.js clean-channel <channel_id> [limit] [--dry-run]
  node index.js clean-all-channel <channel_id> [--dry-run]
  node index.js clean-dm <user_id> [limit] [--dry-run]  
  node index.js clean-all-dm <user_id> [--dry-run]

📝 Örnekler:
  node index.js clean-channel 123456789012345678 50
  node index.js clean-channel 123456789012345678        # Tüm mesajlar
  node index.js clean-all-channel 123456789012345678    # Tüm mesajlar (açık)
  node index.js clean-dm 987654321098765432 100
  node index.js clean-dm 987654321098765432             # Tüm mesajlar
  node index.js clean-all-dm 987654321098765432 --dry-run

⚠️  Limit belirtilmezse TÜM MESAJLAR silinir!
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
