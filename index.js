const { Client, GatewayIntentBits, AuditLogEvent } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // Kluczowe uprawnienie, aby bot widział tekst wiadomości!
    ]
});

// 1. TUTAJ WPISZ ID KANAŁU, NA KTÓRYM BOT MA PISAĆ O AUTOMATYCZNYCH BANACH Z ANTI-NUKE
const ID_KANALU_LOGOW = "1523313273078943835";

const raidersCache = new Map();
const LIMIT_AKCJI = 2;       
const CZAS_RESETU = 60000;   

client.once('ready', () => {
    console.log(`✅ System Anti-Nuke uruchomiony! Bot zalogowany jako: ${client.user.tag}`);
});

// Funkcja pomocnicza do systemu Anti-Nuke
async function sprawdzModeratora(guild, executor, powodAkcji) {
    if (executor.id === guild.ownerId || executor.id === client.user.id) return;

    const teraz = Date.now();
    if (!raidersCache.has(executor.id)) {
        raidersCache.set(executor.id, []);
    }

    const historiaAkcji = raidersCache.get(executor.id);
    historiaAkcji.push(teraz);

    const aktualneAkcje = historiaAkcji.filter(czas => teraz - czas < CZAS_RESETU);
    raidersCache.set(executor.id, aktualneAkcje);

    if (aktualneAkcje.length > LIMIT_AKCJI) {
        console.log(`⚠️ ALERT ANTI-NUKE: Wykryto masowe działania użytkownika ${executor.tag}!`);
        
        try {
            await guild.members.ban(executor.id, { reason: `🛡️ Anti-Nuke: ${powodAkcji}` });
            console.log(`🛡️ SUKCES: Użytkownik ${executor.tag} został oficjalnie ZBANOWANY!`);

            const kanal = await guild.channels.fetch(ID_KANALU_LOGOW).catch(() => null);
            if (kanal) {
                await kanal.send(`🛡️ **SYSTEM ANTI-NUKE**\n⚠️ Użytkownik **${executor.tag}** (ID: ${executor.id}) został właśnie **ZBANOWANY** za ${powodAkcji}!`);
            }
        } catch (err) {
            console.log(`❌ BŁĄD DISCORDA: Nie udało się zbanować ${executor.tag}. Powód: ${err.message}`);
        }
    }
}

// ==================== NOWOŚĆ: KOMENDA !ban @użytkownik ====================
client.on('messageCreate', async (message) => {
    // Ignoruj wiadomości od innych botów oraz wiadomości poza serwerem (DM)
    if (message.author.bot || !message.guild) return;

    // Sprawdź, czy wiadomość zaczyna się od "!ban"
    if (message.content.startsWith('!ban')) {
        
        // Zabezpieczenie: Sprawdź, czy TY (autor wiadomości) masz uprawnienie do banowania
        if (!message.member.permissions.has('BanMembers')) {
            return message.reply('❌ Nie masz uprawnień (Banowanie członków), aby używać tej komendy!');
        }

        // Wyciągnij pierwszą oznaczoną osobę z wiadomości
        const uzytkownikDoZbanowania = message.mentions.users.first();

        // Jeśli nikt nie został oznaczony (np. wpisałeś samo !ban)
        if (!uzytkownikDoZbanowania) {
            return message.reply('❌ Musisz oznaczyć użytkownika! Przykład: `!ban @nick`');
        }

        try {
            // Próba zbanowania oznaczonej osoby
            await message.guild.members.ban(uzytkownikDoZbanowania.id, { reason: `Ręczny ban nadany przez moderatora: ${message.author.tag}` });
            
            // Wiadomość potwierdzająca na czacie
            await message.channel.send(`🔨 Użytkownik **${uzytkownikDoZbanowania.tag}** został pomyślnie zbanowany przez **${message.author.tag}**!`);
            console.log(`🔨 Moderator ${message.author.tag} użył komendy i zbanował ${uzytkownikDoZbanowania.tag}`);
        } catch (err) {
            // Jeśli coś pójdzie nie tak (np. brak permisji bota lub hierarchia ról)
            await message.reply(`❌ Nie udało się zbanować tego użytkownika. Powód: ${err.message}`);
        }
    }
});
// =========================================================================

// OCHRONA 1: Masowe usuwanie kanałów
client.on('channelDelete', async (channel) => {
    const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null);
    if (!fetchedLogs) return;
    const log = fetchedLogs.entries.first();
    if (log) await sprawdzModeratora(channel.guild, log.executor, 'masowe usuwanie kanałów');
});

// OCHRONA 2: Masowe usuwanie ról
client.on('roleDelete', async (role) => {
    const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
    if (!fetchedLogs) return;
    const log = fetchedLogs.entries.first();
    if (log) await sprawdzModeratora(role.guild, log.executor, 'masowe usuwanie rang (ról)');
});

client.login(process.env.TOKEN);
