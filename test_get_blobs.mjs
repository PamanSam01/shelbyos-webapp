import { ShelbyClient, Network } from "@shelby-protocol/sdk/node";

async function main() {
  const shelbyClient = new ShelbyClient({ 
    network: Network.TESTNET, 
    apiKey: ""
  });

  try {
    const accountBlobs = await shelbyClient.coordination.getAccountBlobs({ 
      account: "0xef6c0132291f1b662ac729c21798cfc7285e080315c4eff3651e9cdbb2aaffe9" 
    });
    console.log("Success! Blobs found:", accountBlobs.length);
  } catch (err) {
    console.error("Error fetching blobs:", err.message);
  }
}

main();
