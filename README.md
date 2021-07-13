# Hyper Search Experiments

This is a benchmark of FTS indexing and querying across multiple hyperbees. This is to evaluate whether a network of Hyper databases where authors publish FTS indexes could be a feasible approach to a distributed search network.

The algorithm used is simple. Input documents are tokenized, stopwords removed, and then the tokens are transformed into a set of unique phonetic strings. These phonetic tokens are stored in a keyspace which is simple to query:

```
idx:${phonetic-token}:${docid}
```

The search query undergoes the same indexing transformation and then documents are looked up from the indexes using the transformed tokens. Documents with multiple hits are ranked higher.

No ranking mechanisms such as TF-IDF, cosign variance, or n-grams are used.

**Takeaways:**

- Indexing time is roughly constant as more databases are added.
- Query time increases predictably according to the algorithm's design, which is `O(T * D)` where `T` is the number of terms and `D` is the number of databases.
- The hyper database, post indexing, inflates the size of data by roughly 10x. We can expect 2x inflation due to the indexes, so 10x is somewhat high.
- The bees are using UTF-8 keys and JSON entries. It's worth examining whether a different encoding could improve performance or space efficiency.
- Network latency is not considered; it's assumed that the bees are fully synced prior to queries.

**Interesting update #1**

Changing the benchmark so that indexes are stored as individual items rather than multiple keys gives a dramatic query-speed improvement. The change is to store indexes as follows:

```
idx:${phonetic-token} = {docIds: [...]}
```

This causes indexing to take significantly longer as the write-batches must be flushed for each entry instead of the full database. However the queries provided ~3-60x improved query times, which is significant (though interestingly more is gained with fewer databases). Presumably the indexing time could be improved by some optimizations.

See "Interesting update #1" results, below. You can find the code in the `interesting-update-1` branch.

## How to run

```
node index.js {num_dbs} {query...}
```

For instance, to run the "evening morning" query with 10 databases:

```
node index.js 10 evening morning
```

You'll need to manually close the process after (because I'm a lazy coder) and then you will probably want to delete `./hyper` between runs to avoid accumulating data.

If you want to run the in-memory version, modify index.js so that the `USE_FAKE` constant is true.

## Results

Using a 2018 Macbook Pro with SSD, 2.3 GHz Quad-Core Intel Core i5, 16 GB 2133 MHz LPDDR3.

Corpus: 31113 documents at ~4.2MB

### In-memory (no hyper), "evening morning"

Indexing: 3.96s
Query: 1.04s

(Queries are likely pretty slow due to a naive approach to filtering results)

### 1 db, "evening morning"

Indexing: 11.3s
Querying: 167ms
Database size: 37MB

### 2 dbs, "evening morning"

Indexing: 11.6s
Querying: 217ms
Database size: 57MB

### 3 dbs, "evening morning"

Indexing: 11.1s
Querying: 222ms
Database size: 57MB

### 5 dbs, "evening morning"

Indexing: 10.8s
Querying: 218ms
Database size: 57MB

### 10 dbs, "evening morning"

Indexing: 11.2s
Querying: 236ms
Database size: 56MB

### 100 dbs, "evening morning"

Indexing: 9.9s
Querying: 376ms
Database size: 58MB

### 500 dbs, "evening morning"

Indexing: 10.0s
Querying: 1.26s
Database size: 65MB

### 1000 dbs, "evening morning"

Indexing: 11.2s
Querying: 1.48s
Database size: 73MB

### 5000 dbs, "evening morning"

Failed with "too many open files"

### 1 db, "how about a long query full of words which may or may not hit a bible verse?"

Indexing: 11.13s
Querying: 602ms
Database size: 37MB

### 10 dbs, "how about a long query full of words which may or may not hit a bible verse?"

Indexing: 10.78s
Querying: 618ms
Database size: 37MB

### 100 dbs, "how about a long query full of words which may or may not hit a bible verse?"

Indexing: 9.76s
Querying: 996ms
Database size: 39MB

### 250 dbs, "how about a long query full of words which may or may not hit a bible verse?"

Indexing: 10s
Querying: 1.76s
Database size: 42MB

### 500 dbs, "how about a long query full of words which may or may not hit a bible verse?"

Indexing: 10.6s
Querying: 3.17s
Database size: 48MB

### 750 dbs, "how about a long query full of words which may or may not hit a bible verse?"

Indexing: 10.6s
Querying: 3.86s
Database size: 54MB

### 1000 dbs, "how about a long query full of words which may or may not hit a bible verse?"

Indexing: 11.8s
Querying: 5.46s
Database size: 59MB

### Interesting update #1, 1 db, "evening morning"

Indexing: 7.6min
Querying: 7ms (24x)

### Interesting update #1, 10 dbs, "evening morning"

Indexing: 6.3min
Querying: 16ms (14.8x)

### Interesting update #1, 100 dbs, "evening morning"

Indexing: 5min
Querying: 76ms (4.9x)

### Interesting update #1, 1000 dbs, "evening morning"

Indexing: 3.9min
Querying: 540ms (2.7x)

### Interesting update #1, 1 db, "how about a long query full of words which may or may not hit a bible verse?"

Indexing: 7.63min
Querying: 10ms (60x)

### Interesting update #1, 10 dbs, "how about a long query full of words which may or may not hit a bible verse?"

Indexing: 6.4min
Querying: 42ms (15x)

### Interesting update #1, 100 dbs, "how about a long query full of words which may or may not hit a bible verse?"

Indexing: 5.05min
Querying: 224ms (4.4x)

### Interesting update #1, 1000 dbs, "how about a long query full of words which may or may not hit a bible verse?"

Indexing: 4.85min
Querying: 1.86s (2.9x)