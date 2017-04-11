import 'babel-polyfill';
import fs from 'fs';
import json2csv from 'json2csv';

function dateToString(date) {
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();
	return `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;
}

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

const termsData = require('./data/terms');

fs.readFile('presidential-speeches.json', 'utf8', (err, data) => {

    if (err) throw err;

    const speechesData = JSON.parse(data).reverse();

    const exportData = {
    	speaker: [],
    	term: [],
    	speaker_terms: [],
    	document: [],
    	speaker_documents: []
    };
    const speakerNameToId = new Map();

    //-------------------------------------------------------------------------
    // SPEAKERS
    //-------------------------------------------------------------------------

    const uniqueSpeakerNames = new Set();
    for (const speechData of speechesData) {
        if (!speechData.name && speechData.title === 'Address to Congress on the American Jobs Act') {
            speechData.name = 'Barack Obama';
        }
    	uniqueSpeakerNames.add(speechData.name);
    }

    let nextSpeakerId = 1;
    for (const name of uniqueSpeakerNames.values()) {
    	const speaker_id = nextSpeakerId++;
    	exportData.speaker.push({
    		speaker_id,
    		name
    	});
    	speakerNameToId.set(name, speaker_id);
    }
    // Manually add Donald Trump.
    const trump_id = nextSpeakerId++;
    const trump_name = 'Donald Trump';
    exportData.speaker.push({
		speaker_id: trump_id,
		name: trump_name
	});
	speakerNameToId.set(trump_name, trump_id);

    //-------------------------------------------------------------------------
    // TERMS
    //-------------------------------------------------------------------------

    let nextTermId = 1;
    for (let i = 0; i < termsData.length; i++) {

    	const termData = termsData[i];

    	const speaker_id = speakerNameToId.get(termData.name);
    	if (!speaker_id) {
    		throw new Error(`Missing speaker ID for term. (${termData.name})`);
    	}

    	for (let j = 0; j < termData.startDates.length; j++) {

    		const termStart = new Date(termData.startDates[j]);
    		let termEnd;
    		if (termData.startDates[j + 1]) {
    			termEnd = new Date(termData.startDates[j + 1]);
    		}
    		else if (termsData[i + 1]) {
    			termEnd = new Date(termsData[i + 1].startDates[0]);
    		}
    		else {
    			termEnd = new Date('1/20/2021');
    		}

    		const term_id = nextTermId++;
    		exportData.term.push({
    			term_id,
    			start_date: dateToString(termStart),
    			end_date: dateToString(termEnd)
    		});

    		exportData.speaker_terms.push({
    			speaker_speaker_id: speaker_id,
    			terms_term_id: term_id
    		});
    	}
    }

    //-------------------------------------------------------------------------
    // DOCUMENTS
    //-------------------------------------------------------------------------

    let nextDocumentId = 1;
    for (const speechData of speechesData) {

    	const document_id = nextDocumentId++;
    	const speaker_id = speakerNameToId.get(speechData.name);
    	if (!speaker_id) {
    		throw new Error('Missing speaker ID for document.');
    	}

		let full_text = fix_string_for_import(speechData.content);
		if (full_text.length > 100000) {
			console.log(`Document with ID ${document_id} has > 100,000 characters (${full_text.length}). SKIPPING`);
            continue;
		}
		const title = fix_string_for_import(speechData.title);
    	exportData.document.push({
    		document_id,
    		delivery_date: dateToString(new Date(speechData.date)),
    		full_text,
    		title,
    		speaker_speaker_id: speaker_id
    	});

    	exportData.speaker_documents.push({
    		speaker_speaker_id: speaker_id,
    		documents_document_id: document_id
    	});
    }

    //-------------------------------------------------------------------------
    // EXPORT
    //-------------------------------------------------------------------------

    const EXPORT_CONFIG = [{
    	tableName: 'speaker',
    	fields: ['speaker_id', 'name']
    }, {
    	tableName: 'term',
    	fields: ['term_id', 'start_date', 'end_date']
    }, {
    	tableName: 'speaker_terms',
    	fields: ['speaker_speaker_id', 'terms_term_id']
    }, {
    	tableName: 'document',
    	fields: ['document_id', 'delivery_date', 'full_text', 'title', 'speaker_speaker_id']
    }, {
    	tableName: 'speaker_documents',
    	fields: ['speaker_speaker_id', 'documents_document_id']
    }];

    const promises = [];
    for (const tableConfig of EXPORT_CONFIG) {
    	promises.push(new Promise((resolve, reject) => {
    		const data = exportData[tableConfig.tableName];
    		const fields = tableConfig.fields;
    		const result = json2csv({ data, fields });
    		fs.writeFile(`import_data/${tableConfig.tableName}.csv`, result, (err) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
    	}));
    }

    // Partial document export.
   	/*const DOCUMENT_STEP = 100;
   	for (let i = 0; i < exportData.document.length; i += DOCUMENT_STEP) {
   		promises.push(new Promise((resolve, reject) => {
   			const data = exportData.document.slice(i, i + DOCUMENT_STEP);
   			for (let i = 0; i < data.length;) {
   				if (data[i].full_text.length > 100000) {
   					data.splice(i, 1);
   					continue;
   				}
   				i++;
   			}
	   		const fields = EXPORT_CONFIG[3].fields;
	   		const result = json2csv({ data, fields });
   			fs.writeFile(`import_data/document_${(i/DOCUMENT_STEP)+1}.csv`, result, (err) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
   		}));
   	}*/

    Promise.all(promises)
    	.then(() => {
    		console.log('PROCESSING SUCCESS');
    	})
    	.catch((err) => {
    		console.log('PROCESSING FAILURE', err);
    	});
});
