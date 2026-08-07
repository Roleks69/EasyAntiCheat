const { Client, GatewayIntentBits, AuditLogEvent } = require('discord.js');
const http = require('http'); // MODUŁ DO UTWORZENIA SZTUCZNEGO SERWERA

// ==================== SZTUCZNY SERWER DLA RENDERA ====================
// Tworzymy serwer, który odpowiada "OK" na żądania Rendera, dzięki czemu hosting nie wyłączy bota
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('🛡️ System Anti-Nuke działa stabilnie w chmurze!');
});

// Render automatycznie przypisuje port w zmiennej process.env.PORT (domyślnie 10000)
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`📡 Sztuczny serwer webowy nasłuchuje na porcie: ${PORT}`);
});
// =====================================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const ID_KANALU_LOGOW = "TUTAJ_WKLEJ_ID_KANALU_TEKSTOWEGO";

const raidersCache = new Map();
const LIMIT_AKCJI = 2;       
const CZAS_RESETU = 60000;   

client.once('ready', () => {
    console.log(`✅ System Anti-Nuke uruchomiony! Bot zalogowany jako: ${client.user.tag}`);
});

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

// KOMENDA !ban @użytkownik
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content.startsWith('!ban')) {
        if (!message.member.permissions.has('BanMembers')) {
            return message.reply('❌ Nie masz uprawnień (Banowanie członków), aby używać tej komendy!');
        }

        const uzytkownikDoZbanowania = message.mentions.users.first();
        if (!uzytkownikDoZbanowania) {
            return message.reply('❌ Musisz oznaczyć użytkownika! Przykład: `!ban @nick`');
        }

        try {
            await message.guild.members.ban(uzytkownikDoZbanowania.id, { reason: `Ręczny ban nadany przez moderatora: ${message.author.tag}` });
            await message.channel.send(`🔨 Użytkownik **${uzytkownikDoZbanowania.tag}** został pomyślnie zbanowany przez **${message.author.tag}**!`);
            console.log(`🔨 Moderator ${message.author.tag} użył komendy i zbanował ${uzytkownikDoZbanowania.tag}`);
        } catch (err) {
            await message.reply(`❌ Nie udało się zbanować tego użytkownika. Powód: ${err.message}`);
        }
    }
});

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
