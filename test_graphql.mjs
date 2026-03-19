async function main() {
  const url = "https://api.testnet.aptoslabs.com/nocode/v1/public/cmlfqs5wt00qrs601zt5s4kfj/v1/graphql";
  const query = `
    query {
      __type(name: "blobs") {
        fields {
          name
        }
      }
    }
  `;
  const variables = {};

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' /* NO API KEY for introspection maybe? */ },
      body: JSON.stringify({ query, variables })
    });
    const json = await response.json();
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.error(err);
  }
}
main();
