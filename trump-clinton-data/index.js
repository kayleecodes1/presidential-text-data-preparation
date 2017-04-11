import 'babel-polyfill';
import path from 'path';
import fs from 'fs';
import json2csv from 'json2csv';
import config from './config.js';

function fix_string_for_import(str) {

	return str
        // Normalize single quotes.
        .replace(/[\u0027\u0060\u00B4\u2018\u2019]/gi, '\'')
        // Remove double quotes.
        .replace(/[\u0022\u201C\u201D]/gi, '')
        // Remove non-ASCII.
        .replace(/[^\u0000-\u007F]/gi, '')
        // Remove transcript annotations.
        .replace(/\((Applause|Laughter|Inaudible)\.\)/g, '')
        // Replace multiple spaces with a single space.
        .replace(/[ ][ ]*/g, ' ');
}

const TRUMP_SPEAKER_ID = config.trumpSpeakerId;
const CLINTON_SPEAKER_ID = config.clintonSpeakerId;
let START_DOCUMENT_ID = config.startDocumentId;

const exportData = {
	document: [],
	speaker_documents: []
};

for (const name of ['trump', 'clinton']) {
	const speaker_id = name === 'trump' ? TRUMP_SPEAKER_ID : CLINTON_SPEAKER_ID;
	const sourcePath = path.join(__dirname, 'data', name);
	const directories = fs.readdirSync(sourcePath)
		.filter((file) => fs.statSync(path.join(sourcePath, file)).isDirectory());
	for (const directory of directories) {
		const files = fs.readdirSync(path.join(sourcePath, directory));
		for (const file of files) {
			try {
				const data = fs.readFileSync(path.join(sourcePath, directory, file), 'utf8');
				const speechData = JSON.parse(data);
				const document_id = START_DOCUMENT_ID++;
				exportData.document.push({
					document_id,
		    		delivery_date: speechData.date,
		    		full_text: fix_string_for_import(speechData.text),
		    		title: speechData.title,
		    		speaker_speaker_id: speaker_id
		    	});
		    	exportData.speaker_documents.push({
		    		speaker_speaker_id: speaker_id,
		    		documents_document_id: document_id
		    	});
			}
			catch (error) {
				console.log(`ERROR in ${path.join(sourcePath, directory, file)}`, error);
			}
		}
	}
}

const EXPORT_CONFIG = [{
	tableName: 'document',
	fields: ['document_id', 'delivery_date', 'full_text', 'title', 'speaker_speaker_id']
}, {
	tableName: 'speaker_documents',
	fields: ['speaker_speaker_id', 'documents_document_id']
}];

for (const tableConfig of EXPORT_CONFIG) {
	const data = exportData[tableConfig.tableName];
	const fields = tableConfig.fields;
	const result = json2csv({ data, fields });
	fs.writeFileSync(path.join(__dirname, 'import_data', `${tableConfig.tableName}.csv`), result);
}
