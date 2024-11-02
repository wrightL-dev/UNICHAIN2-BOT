import TelegramBot from 'node-telegram-bot-api';
import Web3 from 'web3';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const web3Sepolia = new Web3(new Web3.providers.HttpProvider(process.env.SEPOLIA_RPC_URL));
const web3Unichain = new Web3(new Web3.providers.HttpProvider(process.env.UNICHAIN_RPC_URL));

const senderAddress = process.env.SENDER_ADDRESS;
const privateKey = process.env.PRIVATE_KEY;
const chatId = process.env.CHAT_ID;

bot.onText(/\/start/, (msg) => {
    const options = {
        reply_markup: {
            keyboard: [
                ['Bridge Sepolia ETH > Unichain'],
                ['Bridge Unichain > Sepolia ETH'],
                ['Tx Unichain > Random Wallet'],
                ['Cek Total Transaksi']
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
        },
    };
    bot.sendMessage(chatId, 'Pilih opsi:', options);
});

bot.on('message', async (msg) => {
    if (msg.chat.id !== parseInt(chatId)) return;

    if (msg.text === 'Bridge Sepolia ETH > Unichain') {
        bot.sendMessage(chatId, 'Masukkan jumlah yang akan di-bridge:');
        bot.once('message', async (amountMsg) => {
            const amount = parseFloat(amountMsg.text) || 0.01;
            bot.sendMessage(chatId, 'Ingin berapa kali bridge?');
            bot.once('message', async (countMsg) => {
                const count = parseInt(countMsg.text) || 1;
                for (let i = 0; i < count; i++) {
                    await bridgeSepoliaToUnichain(amount, chatId);
                    const delay = Math.floor(Math.random() * (15000 - 11000 + 1) + 11000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            });
        });
    } else if (msg.text === 'Bridge Unichain > Sepolia ETH') {
        bot.sendMessage(chatId, 'Masukkan jumlah yang akan di-bridge:');
        bot.once('message', async (amountMsg) => {
            const amount = parseFloat(amountMsg.text) || 0.01;
            bot.sendMessage(chatId, 'Ingin berapa kali bridge?');
            bot.once('message', async (countMsg) => {
                const count = parseInt(countMsg.text) || 1;
                for (let i = 0; i < count; i++) {
                    await bridgeUnichainToSepolia(amount, chatId);
                    const delay = Math.floor(Math.random() * (15000 - 11000 + 1) + 11000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            });
        });
    } else if (msg.text === 'Tx Unichain > Random Wallet') {
        bot.sendMessage(chatId, 'Masukkan nama file wallet (contoh: wallets.txt) atau masukkan alamat wallet langsung:');
        bot.once('message', async (inputMsg) => {
            let wallets = [];
            if (fs.existsSync(inputMsg.text)) {
                wallets = fs.readFileSync(inputMsg.text, 'utf8').split('\n').map(line => line.trim()).filter(Boolean);
            } else if (web3Unichain.utils.isAddress(inputMsg.text)) {
                wallets.push(inputMsg.text);
            } else {
                bot.sendMessage(chatId, 'Alamat wallet tidak valid dan file tidak ditemukan.');
                return;
            }
            bot.sendMessage(chatId, 'Masukkan Jumlah Transaksi (Transfer kecil aja 0.0000001):');
            bot.once('message', async (amountMsg) => {
                const amount = parseFloat(amountMsg.text) || 0.0000001;
                bot.sendMessage(chatId, 'Ingin berapa kali transaksi berulang?');
                bot.once('message', async (countMsg) => {
                    const count = parseInt(countMsg.text) || 1;
                    for (let i = 0; i < count; i++) {
                        for (const wallet of wallets) {
                            await sendEth(wallet, amount, chatId);
                            const delay = Math.floor(Math.random() * (15000 - 11000 + 1) + 11000);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    }
                });
            });
        });
    } else if (msg.text === 'Cek Total Transaksi') {
        await fetchTransactionCount(chatId);
    }
});

function generateUuid() {
    return uuidv4();
}

function generateMixpanelCookieValue() {
    const distinct_id = generateUuid();
    const device_id = generateUuid().replace(/-/g, '');
    return {
        "distinct_id": distinct_id,
        "$device_id": device_id,
        "$initial_referrer": "$direct",
        "$initial_referring_domain": "$direct",
        "Chain id": "1301",
        "Environment": "Prod",
        "Authorized": false,
        "Viewport width": 433,
        "Viewport height": 656,
        "Language": "id-ID",
        "Device type": "Browser",
        "User id": distinct_id,
        "$user_id": distinct_id
    };
}

function generateCookies() {
    const uuidValue = generateUuid();
    const mixpanelValue = generateMixpanelCookieValue();
    const mixpanelHash = uuidValue.slice(0, 10);
    const mixpanelCookieName = `mp_${mixpanelHash}_mixpanel`;
    const cookieString = [
        `chakra-ui-color-mode=dark`,
        `uuid=${uuidValue}`,
        `chakra-ui-color-mode-hex=#101112`,
        `indexing_alert=false`,
        `nav_bar_collapsed=true`,
        `adblock_detected=false`,
        `${mixpanelCookieName}=${encodeURIComponent(JSON.stringify(mixpanelValue))}`
    ].join('; ');
    return cookieString;
}

async function fetchTransactionCount(chatId) {
    const cookies = generateCookies();
    const headers = {
        'accept': '*/*',
        'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'cookie': cookies,
        'Referer': `https://unichain-sepolia.blockscout.com/address/${senderAddress}?tab=txs`,
        'Referrer-Policy': 'origin-when-cross-origin'
    };
    const url = `https://unichain-sepolia.blockscout.com/api/v2/addresses/${senderAddress}/counters`;
    try {
        const response = await axios.get(url, { headers });
        const transactionsCount = response.data.transactions_count || 'N/A';
        bot.sendMessage(chatId, `Unichain-Bot:\nTotal Transaksi: ${transactionsCount}\nLink: https://unichain-sepolia.blockscout.com/address/${senderAddress}?tab=txs`);
    } catch (error) {
        bot.sendMessage(chatId, `Unichain-Bot:\nError fetching transaction count: ${error.message}`);
    }
}

async function bridgeSepoliaToUnichain(amount, chatId) {
    try {
        const nonce = await web3Sepolia.eth.getTransactionCount(senderAddress);
        const gasPrice = await web3Sepolia.eth.getGasPrice();
        const tx = {
            from: senderAddress,
            to: senderAddress,
            value: web3Sepolia.utils.toWei(amount.toString(), 'ether'),
            gas: 21000,
            gasPrice: gasPrice,
            nonce: nonce,
            chainId: 11155111,
        };
        const signedTx = await web3Sepolia.eth.accounts.signTransaction(tx, privateKey);
        const receipt = await web3Sepolia.eth.sendSignedTransaction(signedTx.rawTransaction);
        bot.sendMessage(chatId, `Unichain-Bot:\nTransaksi Sepolia berhasil!\nTX HASH ID: ${receipt.transactionHash}\nLink: https://sepolia.etherscan.io/tx/${receipt.transactionHash}`);
    } catch (error) {
        bot.sendMessage(chatId, `Unichain-Bot:\nTerjadi kesalahan saat proses bridge: ${error.message}`);
    }
}

async function bridgeUnichainToSepolia(amount, chatId) {
    try {
        const nonce = await web3Unichain.eth.getTransactionCount(senderAddress);
        const gasPrice = await web3Unichain.eth.getGasPrice();
        const tx = {
            from: senderAddress,
            to: senderAddress,
            value: web3Unichain.utils.toWei(amount.toString(), 'ether'),
            gas: 21000,
            gasPrice: gasPrice,
            nonce: nonce,
            chainId: 1301,
        };
        const signedTx = await web3Unichain.eth.accounts.signTransaction(tx, privateKey);
        const receipt = await web3Unichain.eth.sendSignedTransaction(signedTx.rawTransaction);
        bot.sendMessage(chatId, `Unichain-Bot:\nTransaksi Unichain berhasil!\nTX HASH ID: ${receipt.transactionHash}\nLink: https://unichain-sepolia.blockscout.com/tx/${receipt.transactionHash}`);
    } catch (error) {
        bot.sendMessage(chatId, `Unichain-Bot:\nTerjadi kesalahan saat proses bridge: ${error.message}`);
    }
}

async function sendEth(toAddress, amount, chatId) {
    try {
        const nonce = await web3Unichain.eth.getTransactionCount(senderAddress);
        const gasPrice = await web3Unichain.eth.getGasPrice();
        
        // Pastikan jumlah dalam format desimal untuk menghindari notasi ilmiah
        const amountFormatted = web3Unichain.utils.toWei(amount.toFixed(10).toString(), 'ether');
        
        const tx = {
            from: senderAddress,
            to: toAddress,
            value: amountFormatted,
            gas: 21000,
            gasPrice: gasPrice,
            nonce: nonce,
            chainId: 1301,
        };

        const signedTx = await web3Unichain.eth.accounts.signTransaction(tx, privateKey);
        const receipt = await web3Unichain.eth.sendSignedTransaction(signedTx.rawTransaction);
        bot.sendMessage(chatId, `Unichain-Bot:\nTransaksi Unichain berhasil!\nTX HASH ID: ${receipt.transactionHash}\nLink: https://unichain-sepolia.blockscout.com/tx/${receipt.transactionHash}`);
    } catch (error) {
        bot.sendMessage(chatId, `Unichain-Bot:\nTerjadi kesalahan saat mengirim transaksi ke ${toAddress}: ${error.message}`);
    }
}