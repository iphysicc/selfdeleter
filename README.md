# Discord Message Cleaner (Selfbot)

Discord selfbot'u kullanarak belirtilen DM veya sunucu kanalındaki kendi mesajlarınızı temizleyen uygulama.

## ⚠️ ÖNEMLİ UYARILAR

- **Discord ToS İhlali**: Selfbot kullanımı Discord'un Hizmet Şartları'na aykırıdır
- **Hesap Riski**: Hesabınız askıya alınabilir veya yasaklanabilir
- **Sadece Eğitim Amaçlı**: Bu kod sadece eğitim ve araştırma amaçlıdır
- **Kendi Sorumluluğunuzda**: Kullanım tamamen kendi riskinizdir

## 🚀 Kurulum

1. Projeyi klonlayın veya indirin
2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. `.env` dosyası oluşturun:
```bash
cp .env.example .env
```

4. `.env` dosyasını düzenleyin ve token'ınızı ekleyin

## 🔑 Token Alma

1. Discord web/desktop uygulamasını açın
2. F12 ile Developer Tools'u açın
3. Network sekmesine gidin
4. Herhangi bir işlem yapın (mesaj gönder, kanal değiştir)
5. `api/v9` isteklerinden birini seçin
6. Headers bölümünde `authorization` değerini kopyalayın

## 📖 Kullanım

### Kanal Mesajlarını Temizleme
```bash
# HIZLI YÖNTEM - Discord arama API'si (ÖNERİLEN)
node index.js clean-channel-fast 123456789012345678 100

# Geleneksel yöntem - Tüm mesajları çekip filtrele (YAVAS)
node index.js clean-channel 123456789012345678 100

# TÜM mesajları sil (limit belirtilmezse)
node index.js clean-channel-fast 123456789012345678

# Açıkça tüm mesajları sil
node index.js clean-all-channel 123456789012345678

# Dry run (sadece sayım, silme yok)
node index.js clean-channel-fast 123456789012345678 50 --dry-run
```

### DM Mesajlarını Temizleme
```bash
# Belirtilen kullanıcıyla olan DM'den 50 mesaj sil
node index.js clean-dm 987654321098765432 50

# TÜM DM mesajlarını sil (limit belirtilmezse)
node index.js clean-dm 987654321098765432

# Açıkça tüm DM mesajlarını sil
node index.js clean-all-dm 987654321098765432

# Dry run
node index.js clean-dm 987654321098765432 100 --dry-run
```

## ⚙️ Özellikler

- ✅ Kanal ve DM mesaj temizleme
- ✅ **HIZLI ARAMA** - Discord arama API'si kullanımı
- ✅ **Limitsiz temizleme** - Tüm mesajları sil
- ✅ Rate limiting (ban koruması)
- ✅ Dry run modu
- ✅ Mesaj filtreleme
- ✅ Toplu silme
- ✅ İlerleme göstergesi
- ✅ Hata yönetimi
- ✅ 5 saniye güvenlik bekleme süresi (tüm mesaj silme için)
- ✅ Otomatik fallback (arama API'si çalışmazsa geleneksel yöntem)

## 🛡️ Güvenlik

- Rate limiting varsayılan olarak 1.5 saniye
- Sadece kendi mesajlarınızı siler
- API hatalarını yakalar ve devam eder
- Dry run modu ile test edebilirsiniz

## 📋 Gereksinimler

- Node.js 16+
- Discord hesabı
- Geçerli Discord user token

## ⚠️ Yasal Uyarı

Bu yazılım sadece eğitim amaçlıdır. Discord'un Hizmet Şartları'nı ihlal edebilir ve hesap yasaklanmasına neden olabilir. Kullanım tamamen kendi sorumluluğunuzdadır.

## 🤝 Katkıda Bulunma

Bu proje eğitim amaçlıdır. Katkılar kabul edilmez.

## 📄 Lisans

MIT License - Sadece eğitim amaçlı kullanım için.