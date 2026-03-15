// Benchmark for PostgreSQL adapter read performance optimizations
// Measures: scalar equality queries, $in queries, deserialization

const postgres = require('../adapters/postgres');

const user = process.env.PGUSER || process.env.USER;
const password = process.env.PGPASSWORD || '';
const auth = password ? `${user}:${password}@` : `${user}@`;

async function run() {
  const client = await postgres.connect(`postgres://${auth}localhost:5432/dbtest_adapter`);
  const db = client.db();
  const col = db.collection('benchmark');

  // Clean up
  try {
    await col.drop();
  } catch (e) {
    // ignore
  }

  // Seed data: simulate ApostropheCMS page-like documents
  const docs = [];
  for (let i = 0; i < 500; i++) {
    docs.push({
      _id: `doc${i}`,
      slug: `/page-${i}`,
      type: i % 3 === 0 ? '@apostrophecms/page' : '@apostrophecms/piece',
      aposLocale: i % 2 === 0 ? 'en:published' : 'en:draft',
      aposMode: i % 2 === 0 ? 'published' : 'draft',
      visibility: 'public',
      title: `Document ${i}`,
      tags: [ 'tag' + (i % 10), 'tag' + (i % 5) ],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-06-15'),
      content: {
        widgets: [
          {
            type: 'rich-text',
            content: '<p>Lorem ipsum dolor sit amet, '.repeat(20) + '</p>',
            _id: `widget${i}_1`
          },
          {
            type: 'image',
            src: '/images/photo.jpg',
            alt: 'A photo',
            _id: `widget${i}_2`
          }
        ],
        metaType: 'area'
      },
      seo: {
        title: `SEO Title ${i}`,
        description: 'A description of the page for search engines'
      }
    });
  }
  await col.insertMany(docs);

  const iterations = 1000;

  // Benchmark 1: Multi-field scalar equality (simulates page lookup)
  console.log('\n--- Benchmark 1: Multi-field scalar equality ---');
  let start = Date.now();
  for (let i = 0; i < iterations; i++) {
    await col.findOne({
      slug: `/page-${i % 500}`,
      aposLocale: 'en:published',
      visibility: 'public'
    });
  }
  let elapsed = Date.now() - start;
  console.log(`${iterations} three-field findOne queries: ${elapsed}ms (${(elapsed / iterations).toFixed(2)}ms/query)`);

  // Benchmark 2: $in on _id (simulates batch loading related docs)
  console.log('\n--- Benchmark 2: $in on _id ---');
  start = Date.now();
  for (let i = 0; i < iterations; i++) {
    const ids = [];
    const base = (i * 7) % 480;
    for (let j = 0; j < 20; j++) {
      ids.push(`doc${base + j}`);
    }
    await col.find({ _id: { $in: ids } }).toArray();
  }
  elapsed = Date.now() - start;
  console.log(`${iterations} _id $in(20) queries: ${elapsed}ms (${(elapsed / iterations).toFixed(2)}ms/query)`);

  // Benchmark 3: $in on regular field with array containment
  console.log('\n--- Benchmark 3: $in on field (with array match) ---');
  start = Date.now();
  for (let i = 0; i < iterations; i++) {
    await col.find({
      tags: { $in: [ 'tag' + (i % 10), 'tag' + ((i + 3) % 10) ] },
      aposLocale: 'en:published'
    }).toArray();
  }
  elapsed = Date.now() - start;
  console.log(`${iterations} tag $in queries: ${elapsed}ms (${(elapsed / iterations).toFixed(2)}ms/query)`);

  // Benchmark 4: Simulated page load (multiple queries in sequence)
  console.log('\n--- Benchmark 4: Simulated page load (10 queries) ---');
  start = Date.now();
  const pageLoadIterations = 100;
  for (let i = 0; i < pageLoadIterations; i++) {
    const pageSlug = `/page-${(i * 3) % 500}`;
    // 1. Find the page
    const page = await col.findOne({
      slug: pageSlug,
      aposLocale: 'en:published',
      visibility: 'public'
    });
    // 2. Find ancestors (by _id $in)
    await col.find({
      _id: { $in: [ 'doc0', 'doc1', 'doc2' ] }
    }).toArray();
    // 3. Find children
    await col.find({
      type: '@apostrophecms/page',
      aposLocale: 'en:published',
      visibility: 'public'
    }).limit(10).toArray();
    // 4. Find related pieces
    await col.find({
      type: '@apostrophecms/piece',
      aposLocale: 'en:published',
      tags: 'tag3'
    }).limit(5).toArray();
    // 5-10: Additional widget/relationship queries
    for (let j = 0; j < 6; j++) {
      await col.findOne({
        _id: `doc${(i + j * 50) % 500}`
      });
    }
  }
  elapsed = Date.now() - start;
  console.log(`${pageLoadIterations} simulated page loads (10 queries each): ${elapsed}ms (${(elapsed / pageLoadIterations).toFixed(1)}ms/page)`);

  // Clean up
  await col.drop();
  await client.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
