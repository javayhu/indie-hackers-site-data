const fs = require('fs').promises;
const { createObjectCsvWriter } = require('csv-writer');
require("dotenv").config();
const { createClient } = require('@sanity/client');

// Sanity client
const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  perspective: "published",
  useCdn: true, // Set to `false` to bypass the edge cache
  apiVersion: 'v2024-02-28', // Use current date (YYYY-MM-DD) to target the latest API version
});

const query = `*[_type == "product" && visible == true] {
  _id,
  _createdAt,
  "slug": slug.current,
  name,
  order,
  "desc": coalesce(desc[$lang], desc[$defaultLocale]),
  website,
  price,
  category-> {
    order,
    "slug": slug.current,
    "name": coalesce(name[$lang], name[$defaultLocale]),
    group-> {
      order,
      "slug": slug.current,
      "name": coalesce(name[$lang], name[$defaultLocale]),
    },
  },
}`; // [0...50]

const saveToCSV = async () => {
  try {
    let data = await sanityClient.fetch(query, { lang: 'en', defaultLocale: 'en' });
    console.log('Sanity fetch data:', data);

    // Sort data
    data = data.sort((a, b) => {
      if (a.category.group.order !== b.category.group.order) {
        return b.category.group.order - a.category.group.order;
      } else if (a.category.order !== b.category.order) {
        return b.category.order - a.category.order;
      } else {
        return b.order - a.order;
      }
    });

    // Define the CSV file name with current timestamp
    const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '');
    const fileName = `data_${timestamp}.csv`;

    // Create CSV writer
    const csvWriter = createObjectCsvWriter({
      path: fileName,
      header: [
        { id: 'name', title: 'Name' },
        { id: 'group', title: 'Group' },
        { id: 'category', title: 'Category' },
        { id: 'price', title: 'Price' },
        { id: 'website', title: 'Website' },
        { id: 'desc', title: 'Description' },
        { id: 'more', title: 'More' },
        { id: 'date', title: 'Date' }
      ]
    });

    // Prepare records for CSV writer
    const records = data.map(product => ({
      name: product.name,
      group: product.category.group.name,
      category: product.category.name,
      price: product.price ?? 'Free', // Handle null price
      website: product.website.replace(/\/$/, ''), // Remove trailing slash from website
      // desc: product.desc.replace(/,/g, ';'), // Replace commas in description
      desc: product.desc,
      more: 'https://www.indiehackers.site/product/' + product.slug,
      date: formatDate(product._createdAt)
    }));

    // Write records to CSV
    await csvWriter.writeRecords(records);

    console.log(`CSV file saved as ${fileName}`);
  } catch (error) {
    console.error(error);
  }
};

const formatDate = (isoString) => {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

saveToCSV();
