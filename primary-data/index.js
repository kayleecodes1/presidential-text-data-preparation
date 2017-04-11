import 'babel-polyfill';
import path from 'path';
import fs from 'fs';
import request from 'request';
import cheerio from 'cheerio';
import config from './config';

const SCRAPE_URL = config.scrapeUrl;

const MONTHS = {
	January: 0,
	February: 1,
	March: 2,
	April: 3,
	May: 4,
	June: 5,
	July: 6,
	August: 7,
	September: 8,
	October: 9,
	November: 10,
	December: 11
};

let missed = 0;

const links = [];
const json = [];

const html = fs.readFileSync(path.join(__dirname, '/data/speeches-listing.html'));

init();
function init() {

	const $ = cheerio.load(html);

	let currentPresident;
	$('.views-row').each(function() {
		const url = $(this).find('.views-field-title a').attr('href');
		if (!url) {
			console.log('no link');
			return;
		}
		links.push(url);
	});

	processLink(0);
}

function processLink(i) {
	if (i >= links.length) {
		//TODO: finish
		const output = JSON.stringify(json);
		fs.writeFile('presidential-speeches.json', output, 'utf8', () => {
			console.log(`COMPLETE    misses: ${missed}`);
		});
		return;
	}
	console.log('processing item ' + (i + 1));
	const link = links[i];
	getSpeechData(link).then((data) => {
		if (data !== '<MISSED>') {
			json.push(data);
		}
		else {
			missed++;
			console.log('    <MISSED>');
			console.log(`    ${link}`);
		}
		processLink(i + 1);
	});
}

function getSpeechData(speechUrl) {
	return new Promise((resolve, reject) => {
		request(speechUrl, (error, response, html) => {

			if (error) {
				reject(error);
				return;
			}

			const $ = cheerio.load(html);

			const about = $('.about-this-episode');
			const name = about.find('.president-name')
				.text()
				.trim();
			const dateString = about.find('.episode-date')
				.text()
				.trim();
			const date = new Date(dateString);
			const title = $('.presidential-speeches--title')
				.text()
				.trim()
				.match(/^.*: (.*)$/)[1];
			const paragraphs = [];
			let transcriptElement = $('.transcript-inner');
			if (transcriptElement.length) {
				transcriptElement.find('p').each(function() {
					paragraphs.push($(this).text().trim());
				});
			}
			else {
				transcriptElement = $('.view-transcript');
				transcriptElement.find('p').each(function() {
					paragraphs.push($(this).text().trim().replace(/\n\n+/g, '\n'));
				});
			}
			const content = paragraphs.join('\n');

			if (!content) {
				console.log();
				resolve('<MISSED>');
				return;
			}

			resolve({
				name,
				date,
				title,
				content
			});
		});
	});
}
