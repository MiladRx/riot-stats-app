const WEBHOOK_URL = 'https://discord.com/api/webhooks/1495233976762236998/zlYwySQn6xxy8FfSzVOwQcHnLN8XKcyV-tBJ6l8SfMzjTHnvmeewed-ccwThBWls3U9-';
const res = await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    flags: 4096,
    embeds: [{
      color: 0x6ab8f7,
      author: {
        name: 'adam1276 #EUNE',
        icon_url: 'https://ddragon.leagueoflegends.com/cdn/15.1.1/img/profileicon/6.png',
      },
      title: '💎 Promoted to Diamond I!',
      description: '> `Diamond II` **→** `Diamond I`',
      fields: [
        { name: '🏆 Current LP', value: '**45 LP**', inline: true },
      ],
      footer: { text: 'Squad Tracker' },
      timestamp: new Date().toISOString(),
    }]
  })
});
console.log('Status:', res.status, res.status === 204 ? '✅ Success!' : '❌ Failed');
