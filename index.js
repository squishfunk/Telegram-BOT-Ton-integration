const { Telegraf } = require('telegraf');
const TonWeb = require('tonweb');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// Podmień 'YOUR_TELEGRAM_BOT_TOKEN' na token swojego bota
const bot = new Telegraf(process.env.APIKEY);

const tonweb = new TonWeb(new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC', {apiKey: 'b0deae42b76d58e3947e9aece7a23be60c394aa766d0b8c7e9c5b3e5fadfd607'}));
// Ścieżka do pliku z danymi portfeli
const walletsFilePath = path.join(__dirname, 'userWallets.json');

// Wczytywanie danych portfeli z pliku
let userWallets = {};
if (fs.existsSync(walletsFilePath)) {
    const fileData = fs.readFileSync(walletsFilePath, 'utf8');
    userWallets = JSON.parse(fileData);
}

const saveWalletsToFile = () => {
    fs.writeFileSync(walletsFilePath, JSON.stringify(userWallets, null, 2), 'utf8');
};

bot.start((ctx) => {
    ctx.reply('Witaj! Wpisz /createwallet, aby stworzyć nowy portfel TON.');
});

bot.command('createwallet', async (ctx) => {
    try {
        const keyPair = TonWeb.utils.newKeyPair();
        const wallet = tonweb.wallet.create({ publicKey: keyPair.publicKey });
        const address = await wallet.getAddress();

        userWallets[ctx.from.id] = {
            keyPair: keyPair,
            wallet: address.toString(true, true, true)
        };

        saveWalletsToFile();

        ctx.reply(`Twój nowy adres portfela TON: ${address.toString(true, true, true)}`);
    } catch (error) {
        console.error('Error creating wallet:', error);
        ctx.reply('Wystąpił błąd przy tworzeniu portfela. Spróbuj ponownie później.');
    }
});

bot.command('balance', async (ctx) => {
    if (!userWallets[ctx.from.id]) {
        ctx.reply('Najpierw stwórz portfel za pomocą /createwallet.');
        return;
    }

    try {
        const address = userWallets[ctx.from.id].wallet;

        // Pobranie salda
        const balance = await tonweb.getBalance(address);

        // Konwersja salda z nanoTON do TON
        const balanceInTon = TonWeb.utils.fromNano(balance);

        ctx.reply(`Adress: ${address} \nSaldo portfela: ${balanceInTon} TON`);
    } catch (error) {
        console.error('Error fetching balance:', error);
        ctx.reply('Wystąpił błąd przy pobieraniu salda. Spróbuj ponownie później.');
    }
});

bot.command('send', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length !== 3) {
        ctx.reply('Użycie: /send <adres_odbiorcy> <kwota>');
        return;
    }

    const recipientAddress = args[1];
    const amount = parseFloat(args[2]);

    if (!userWallets[ctx.from.id]) {
        ctx.reply('Najpierw stwórz portfel za pomocą /createwallet.');
        return;
    }

    try {
        const keyPair = userWallets[ctx.from.id].keyPair;
        const wallet = tonweb.wallet.create({ address: userWallets[ctx.from.id].wallet });

        const seqno = await wallet.methods.seqno().call() || 0;

        /* zamiana obiektu na Uint8Array */
        const secretKeyArray = new Uint8Array(Object.values(keyPair.secretKey));

        const transfer = wallet.methods.transfer({
            secretKey: secretKeyArray,
            toAddress: recipientAddress,
            amount: amount,
            seqno: seqno,
            sendMode: 3,
        });

        await transfer.send();

        ctx.reply(`Przesłano ${amount} TON na adres: ${recipientAddress}`);
    } catch (error) {
        console.error('Error sending funds:', error);
        ctx.reply('Wystąpił błąd przy wysyłaniu środków. Sprawdź dane i spróbuj ponownie.');
    }
});

bot.launch();

console.log('Bot działa!');
