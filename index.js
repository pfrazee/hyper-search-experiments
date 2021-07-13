import natural from 'natural'
import stopwords from 'stopwords'
import fs from 'fs'
import {FakeDB} from './fakedb.js'
import * as hyper from './hyperdb.js'
const tokenizer = new natural.AggressiveTokenizer()

let start = Date.now()
const log = console.log
console.log = (...args) => {
  if (args[0]?.ts) {
    let now = Date.now()
    log(...args.slice(1), `(${now - start}ms)`)
    start = now
  } else {
    log(...args)
  }
}

const USE_FAKE = false
const ALL_DBS = []
const NUM_DBS = Number(process.argv[2])
const DB_FOR = docid => ALL_DBS[docid % NUM_DBS]
if (!USE_FAKE) await hyper.setup()
for (let i = 0; i < NUM_DBS; i++) {
  if (USE_FAKE) {
    ALL_DBS.push(new FakeDB())
  } else {
    ALL_DBS.push(hyper.create())
  }
}

console.log('Reading documents...')
const DOCS = fs.readdirSync(`./corpus`).map(name => fs.readFileSync(`./corpus/${name}`, 'utf8').split(`\n`).filter(line => !!line.trim() && !line.startsWith('#'))).flat()
console.log({ts: true}, `Done (${DOCS.length} documents)`)
console.log('Indexing (this may take multiple minutes)...')
for (let i = 0; i < DOCS.length; i++) {
  await index(i, DOCS[i])
}
// for (let db of ALL_DBS) {
//   await db.tx.flush()
// }
console.log({ts: true}, 'Done')

console.log('Executing query...')
const query = process.argv.slice(3)
const results = await search(query)
console.log({ts: true}, 'Done')
console.log('Search results for:', query.join(' '))
console.log(results)

/*const tokens = toTokens(`
In information retrieval, tf–idf, TF*IDF, or TFIDF, short for term frequency–inverse document frequency, is a numerical statistic that is intended to reflect how important a word is to a document in a collection or corpus.[1] It is often used as a weighting factor in searches of information retrieval, text mining, and user modeling. The tf–idf value increases proportionally to the number of times a word appears in the document and is offset by the number of documents in the corpus that contain the word, which helps to adjust for the fact that some words appear more frequently in general. tf–idf is one of the most popular term-weighting schemes today. A survey conducted in 2015 showed that 83% of text-based recommender systems in digital libraries use tf–idf.[2]

Variations of the tf–idf weighting scheme are often used by search engines as a central tool in scoring and ranking a document's relevance given a user query. tf–idf can be successfully used for stop-words filtering in various subject fields, including text summarization and classification. 
`)

const query = process.argv.slice(2)
for (let queryToken of toTokens(query)) {
  if (tokens.includes(queryToken)) {
    console.log('hit', queryToken)
  }
}*/


function toTokens (str) {
  let arr = Array.isArray(str) ? str : tokenizer.tokenize(str)
  return [...new Set(arr.map(token => token.toLowerCase()).filter(token => !stopwords.english.includes(token)))].map(token => natural.Metaphone.process(token))
}

async function index (id, text) {
  const db = DB_FOR(id)
  
  const tx = DB_FOR(id).batch()
  // if (!db.tx) db.tx = db.batch()
  // const tx = db.tx

  await tx.put(`docs:${id}`, {text})
  for (let token of toTokens(text)) {
    const item = await db.get(`idx:${token}:${id}`)
    const value = item?.value || {docIds: []}
    value.docIds.push(id)
    await tx.put(`idx:${token}`, value)
  }
  await tx.flush()
}

async function search (query, limit = 10) {
  const queryTokens = toTokens(query)
  const getsPromises = []
  for (let db of ALL_DBS) {
    for (let qt of queryTokens) {
      getsPromises.push(db.get(`idx:${qt}`))
    }
  }
  const getResults = await Promise.all(getsPromises)
  const docIdHits = {}
  for (let item of getResults) {
    if (!item?.value?.docIds?.length) continue
    for (let docId of item.value.docIds) {
      docIdHits[docId] = (docIdHits[docId] || 0) | 1
    }
  }
  const docIdsSorted = Object.keys(docIdHits).sort((a, b) => docIdHits[b] - docIdHits[a])
  return Promise.all(docIdsSorted.slice(0, limit).map(docId => DB_FOR(docId).get(`docs:${docId}`)))
}

