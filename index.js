const { Client, GatewayIntentBits, AuditLogEvent } = require('discord.js');
const http = require('http'); 

// ==================== POPRAWIONY SERWER DLA RENDERA ====================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('🛡️ System Anti-Nuke działa stabilnie w chmurze!');
});

const PORT = process.env.PORT || 10000;
// KLUCZOWE: Dodany host "0.0.0.0", aby Render widział ten serwer z zewnątrz
server.listen(PORT, '0.0.0.0', () => {
    console.log(`📡 Serwer webowy nasłuchuje na porcie: ${PORT}`);
});
// =====================================================================

// ==================== ZABEZPIECZENIE PRZED CRASHAMI ====================
// Ten kod sprawi, że bot nigdy się nie wyłączy, nawet jeśli Discord sypnie błędem sieciowym
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Wykryto nieobsłużony błąd (Rejection):', reason);
});
process.on('uncaughtException', (err, origin) => {
    console.error('⚠️ Wykryto krytyczny błąd (Exception):', err);
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

// ID KANAŁU, NA KTÓRYM BOT MA PISAĆ O AUTOMATYCZNYCH BANACH Z ANTI-NUKE
const ID_KANALU_LOGOW = "1523313273078943835";

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

const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot działa!'));
app.listen(process.env.PORT || 10000);
