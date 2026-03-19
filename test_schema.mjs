// Use the ShelbyNet API key to fetch the Testnet indexer schema
const url = "https://api.testnet.aptoslabs.com/nocode/v1/public/cmlfqs5wt00qrs601zt5s4kfj/v1/graphql";
const apiKey = "aptoslabs_GxkddQZDDDj_NbUNmsuDQrazNwzwksioXvYKZk3tceqky"; // try shelbynet key

const query = `
  query {
    __type(name: "blobs") {
      fields {
        name
        type {
          name
          kind
        }
      }
    }
  }
`;

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({ query })
});

const json = await res.json();
if (json.errors) {
  console.log("ERRORS:", JSON.stringify(json.errors, null, 2));
} else {
  const fields = json.data?.__type?.fields || [];
  console.log("AVAILABLE FIELDS in 'blobs':");
  fields.forEach(f => console.log(` - ${f.name}: ${f.type?.name || f.type?.kind}`));
}
