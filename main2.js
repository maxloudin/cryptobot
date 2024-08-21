const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');
const { PDFDocument } = require('pdf-lib');
const { pdfToPng } = require('pdf-to-png-converter'); // Ajout de pdf-to-png-converter pour convertir le PDF en images
const { format } = require('date-fns');
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');


dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const TOKEN = 'MTI2ODUwODI3Njg5OTg0NDEzNg.GAiB8D.rz4ECHts8nUzqqWoXeiU--JFEo1LoKkDtE9OWQ'; // Remplacez par le token de votre bot
const NEWS_CHANNEL_ID = '1268512083511738420'; // Remplacez par l'ID du canal Discord pour Journal du Coin
const INVESTING_CHANNEL_ID = '1268512172762337330'; // Remplacez par l'ID du canal Discord pour Investing.com
const CALENDAR_CHANNEL_ID = '1268512154164658186';
const CHECK_INTERVAL = 1; // Intervalle de vérification en minutes

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

let lastPostedArticlesJDC = [];
let lastPostedArticlesInvesting = [];


async function generateAndSendCalendar(client) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.log('Navigation vers la page...');
        await page.goto('https://fr.investing.com/economic-calendar/');

        // Gestion des cookies et des popups
        try {
            await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 5000 });
            await page.click('#onetrust-accept-btn-handler');
        } catch (error) {
            console.log('Cookies déjà acceptés ou bouton non trouvé.');
        }

        try {
            await page.waitForSelector('.popupCloseIcon.largeBannerCloser', { timeout: 5000 });
            await page.click('.popupCloseIcon.largeBannerCloser');
        } catch (error) {
            console.log('Popup déjà fermée ou non trouvée.');
        }

        // Application des filtres sur le calendrier économique
        await page.click('#filterStateAnchor');
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.click('#importance2');
        await page.click('#importance3');
        await page.click('#ecSubmitButton');
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('Génération du PDF...');
        const pdfPath = 'downloaded_file.pdf';
        await page.pdf({ path: pdfPath, format: 'A4' });

        if (!fs.existsSync(pdfPath)) {
            console.error('Erreur: le fichier PDF n\'a pas été généré.');
            return;
        }

        console.log(`PDF généré: ${pdfPath}`);

        const existingPdfBytes = fs.readFileSync(pdfPath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        const totalPages = pdfDoc.getPageCount();
        if (totalPages > 1) {
            pdfDoc.removePage(totalPages - 1);
            console.log(`Dernière page supprimée, pages restantes: ${pdfDoc.getPageCount()}`);
        }

        const modifiedPdfBytes = await pdfDoc.save();
        const currentDate = format(new Date(), 'dd/MM/yyyy');
        const modifiedPdfPath = `Calendrier_${currentDate.replace(/\//g, '-')}.pdf`;
        fs.writeFileSync(modifiedPdfPath, modifiedPdfBytes);

        console.log('Conversion des pages restantes du PDF en images...');

        // Utilisation de pdf-to-png-converter pour convertir le PDF en images
        const pngImages = await pdfToPng(modifiedPdfPath, {
            outputFolder: './', // Dossier de sortie
            outputFileMask: `page`, // Masque de fichier pour nommer les images
            pagesToProcess: [1] // Conversion des pages restantes du PDF en images
        });

        console.log('Tentative de récupération du canal Discord...');
        const channel = await client.channels.fetch(CALENDAR_CHANNEL_ID);
        console.log('Canal Discord récupéré, envoi des images PNG...');

        // Supprimer les anciens fichiers PDF
        const calendarFiles = fs.readdirSync('./').filter(file => file.startsWith('Calendrier_') && file.endsWith('.pdf') && file !== modifiedPdfPath);
        calendarFiles.forEach(file => {
            fs.unlinkSync(file);
            console.log(`Ancien fichier supprimé: ${file}`);
        });

        for (const image of pngImages) {
            await channel.send({
                content: `**Journée du ${currentDate}**\n\n`,
                files: [{ attachment: image.path, name: path.basename(image.path) }]
            });
        }

        console.log('Images PNG envoyées avec succès sur Discord!');
    } catch (error) {
        console.error('Erreur pendant le processus:', error);
    } finally {
        await browser.close();
    }
}

// Démarrage du bot et planification des tâches
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    setInterval(checkNews, CHECK_INTERVAL * 60 * 1000); // Démarre la tâche de vérification des articles

    // Envoi immédiat du calendrier économique au démarrage du bot
    console.log('Envoi immédiat du calendrier économique...');
    await generateAndSendCalendar(client);

    // Planification pour envoyer le calendrier tous les jours à 7h00 (heure de Paris)
    cron.schedule('0 7 * * 1-5', () => {
        console.log('Début de la tâche planifiée à 7h00 (heure de Paris)...');
        generateAndSendCalendar(client).catch(console.error);
        console.log('Fin de la tâche planifiée.');
    }, {
        timezone: "Europe/Paris"
    });

    console.log('Tâche planifiée pour envoyer le calendrier économique tous les jours à 7:00 du lundi au vendredi.');
});




async function checkNews() {
    await checkJournalDuCoinNews();
    await checkInvestingNews();
}

async function checkJournalDuCoinNews() {
    const channel = client.channels.cache.get(NEWS_CHANNEL_ID);
    if (!channel) {
        console.log(`Erreur : le canal avec l'ID ${NEWS_CHANNEL_ID} est introuvable. Assurez-vous que l'ID est correct et que le bot a accès.`);
        return;
    }

    const latestArticles = await fetchLatestArticleJDC();

    if (!latestArticles.length) {
        console.log("Aucun article trouvé sur Journal du Coin.");
        return;
    }

    const newArticles = latestArticles.filter(article => !lastPostedArticlesJDC.includes(article.title));
    for (const article of newArticles) {
        const formattedDate = dayjs(article.date).tz('Europe/Paris').format('DD/MM/YYYY');
        const message = `**Cryptonews du ${formattedDate}**\n\n> - Titre : ${article.title}\n> - Source : Journal du Coin\n[Lire plus](${article.link})`;
        await channel.send(message);
        lastPostedArticlesJDC.push(article.title);
    }

    if (lastPostedArticlesJDC.length > 100) {
        lastPostedArticlesJDC = lastPostedArticlesJDC.slice(-100);
    }
}

async function checkInvestingNews() {
    const channel = client.channels.cache.get(INVESTING_CHANNEL_ID);
    if (!channel) {
        console.log(`Erreur : le canal avec l'ID ${INVESTING_CHANNEL_ID} est introuvable. Assurez-vous que l'ID est correct et que le bot a accès.`);
        return;
    }

    const latestHeadlines = await fetchLatestArticleHeadlines();
    const latestEconomy = await fetchLatestArticleEconomy();

    const latestArticles = [...latestHeadlines, ...latestEconomy];

    const uniqueArticles = [];
    const seenTitles = new Set();
    for (const article of latestArticles) {
        if (!seenTitles.has(article.title) && !lastPostedArticlesInvesting.includes(article.title)) {
            uniqueArticles.push(article);
            seenTitles.add(article.title);
        }
    }

    if (!uniqueArticles.length) {
        console.log("Aucun article trouvé sur Investing.com.");
        return;
    }

    for (const article of uniqueArticles) {
        const formattedDate = dayjs(article.date).format('DD/MM/YYYY');
        const message = `**Journée du ${formattedDate}**\n\n> - Titre : ${article.title}\n> - Source : ${article.source}\n[Lire plus](${article.link})`;
        await channel.send(message);
        console.log(`Article posté: ${article.title}`);
        lastPostedArticlesInvesting.push(article.title);
    }

    if (lastPostedArticlesInvesting.length > 100) {
        lastPostedArticlesInvesting = lastPostedArticlesInvesting.slice(-100);
    }
}

async function fetchLatestArticleJDC() {
    try {
        const url = "https://journalducoin.com/news/";
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        const firstArticle = $('div.post.is-horizontal.is-horizontal-category').first();

        if (!firstArticle.length) {
            console.log("Aucun article trouvé sur Journal du Coin.");
            return [];
        }

        const titleTag = firstArticle.find('h3.title a');
        const title = titleTag.text().trim();
        const link = titleTag.attr('href');

        const dateText = firstArticle.find('div.date').text().trim().split('•')[0].trim();
        const timeText = firstArticle.find('span.hour').text().replace('•', '').trim();

        console.log(`Date: '${dateText}', Time: '${timeText}'`);

        // Try parsing the date and time strictly
        const dateTime = dayjs(`${dateText} ${timeText}`, 'DD/MM/YYYY HH:mm', true);

        if (!dateTime.isValid()) {
            console.error("Invalid date format detected:", `${dateText} ${timeText}`);
            return [];
        }

        console.log("Valid date:", dateTime.format());

        const categories = firstArticle.find('div.category-maintag a').map((i, el) => $(el).text().trim()).get().join(', ');

        return [{ title, link, date: dateTime, description: categories }];
    } catch (error) {
        console.log(`Erreur lors de la récupération des articles de Journal du Coin: ${error}`);
        return [];
    }
}



async function fetchLatestArticleHeadlines() {
    try {
        const url = "https://fr.investing.com/news/headlines";
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        const firstArticle = $('div.border-b.border-\\[\\#E6E9EB\\].pb-5.pt-4.first\\:pt-0').first();

        const latestArticles = [];

        if (firstArticle.length) {
            const titleTag = firstArticle.find('a.mb-2.inline-block.text-sm.font-semibold.hover\\:underline.sm\\:text-base.sm\\:leading-6');
            const title = titleTag.text().trim();
            const link = titleTag.attr('href');
            const date = firstArticle.find('time[data-test="article-publish-date"]').attr('datetime');

            latestArticles.push({
                title,
                link: `https://fr.investing.com${link}`,
                date,
                source: 'Investing.com'
            });

            console.log(`Article trouvé sur Headlines: ${title}`);
        } else {
            console.log("Aucun article trouvé sur Headlines.");
        }

        return latestArticles;
    } catch (error) {
        console.log(`Erreur lors de la récupération des articles de Headlines: ${error.message}`);
        return [];
    }
}

async function fetchLatestArticleEconomy() {
    try {
        const url = "https://fr.investing.com/news/economy";
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        const firstArticle = $('ul[data-test="news-list"] > li').first();
        const latestArticles = [];

        if (firstArticle.length) {
            const titleTag = firstArticle.find('a[data-test="article-title-link"]');
            const title = titleTag.text().trim();
            let link = titleTag.attr('href');
            const date = firstArticle.find('time[data-test="article-publish-date"]').attr('datetime');

            if (link && !link.startsWith('https://')) {
                link = `https://fr.investing.com${link}`;
            }


            latestArticles.push({
                title,
                link,
                date,
                source: 'Investing.com'
            });

            console.log(`Article trouvé sur Economy: ${title}`);
        } else {
            console.log("Aucun article trouvé sur Economy.");
        }

        return latestArticles;
    } catch (error) {
        console.log(`Erreur lors de la récupération des articles de Economy: ${error.message}`);
        return [];
    }
}


client.login(TOKEN).catch(console.error);