const { Client, GatewayIntentBits, AuditLogEvent } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages
    ]
});

// 1. TUTAJ WPISZ ID KANAŁU, NA KTÓRYM BOT MA PISAĆ O BANACH
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

// OCHRONA 1: Masowe usuwanie kanałów
client.on('channelDelete', async (channel) => {
    const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null);
    if (!fetchedLogs) return;
    const log = fetchedLogs.entries.first();
    if (log) await sprawdzModeratora(channel.guild, log.executor, 'masowe usuwanie kanałów');
});

// OCHRONA 2: Masowe usuwanie ról (rang) - NOWOŚĆ!
client.on('roleDelete', async (role) => {
    const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
    if (!fetchedLogs) return;
    const log = fetchedLogs.entries.first();
    if (log) await sprawdzModeratora(role.guild, log.executor, 'masowe usuwanie rang (ról)');
});

client.login(process.env.TOKEN);

