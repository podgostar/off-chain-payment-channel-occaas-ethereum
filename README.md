# Experimenting with OCCaaS-based off-chain payment channel utilizing Ethereum platform

### Prerequisites

```
NodeJS (v18+)
Truffle (v5+)
3 running (private-network) IPFS/IPNS nodes
Ethereum Sepolia RPC and WS endpoints
4 Ethereum Sepolia accounts (with some funds) and access to their credentials
```

### Installing, configuring, and running the experiment


Clone this repo:

```
git clone off-chain-payment-channel-occaas-ethereum
```

Set values in truffle-config.js

```
const mnemonic = "MNEMONIC-HERE";

sepolia: {
  provider: () => new HDWalletProvider(mnemonic, `WEB3-RPC-ENDPOINT`),
  network_id: 11155111,       
  gas: 5500000,       
  confirmations: 2,   
  timeoutBlocks: 200,  
  skipDryRun: true    
},

```

Inside folder, run:

```
npm i
truffle compile
truffle deploy --reset --network sepolia
```

Set values in .\payment-channel-service\configuration.js
```
const RPC_ENCPOINT = "insert your RPC endpoint here"
const WS_ENCPOINT = "insert your WS endpoint here"

const oracle = "insert your oracle address here"
const oraclepk = "insert your oracle private key here"

// IPFS connection parameters
const host = "insert your IPFS host here";
const port = 'insert your IPFS port here';
const protocol = "insert your IPFS protocol here";
```

Set values in .\payment-channel-client\configuration.js
```
const RPC_ENCPOINT = "insert your RPC endpoint here"
const WS_ENCPOINT = "insert your WS endpoint here"

// IPFS connection parameters
const host = "insert your IPFS host here";
const port = 'insert your IPFS port here';
const protocol = "insert your IPFS protocol here";
```

Set values in .\experiment\configuration.js

```
// Blockchain node RPC endpoint
const RPC_ENCPOINT = "insert your RPC endpoint here"
const WS_ENCPOINT = "insert your WS endpoint here"

// IPFS/IPNS connection parameters
const host = "insert your IPFS host here";
const port = 'insert your IPFS port here';
const protocol = "insert your IPFS protocol here";

// Users credentials
const stakeholderA = "insert your stakeholder 1 (User A) address here"
const stakeholderApk = "insert your stakeholder 1 (User A) private key here"
const stakeholderB = "insert your stakeholder 2 (User B) address here"
const stakeholderBpk = "insert your stakeholder 2 (User B) private key here"
const stakeholderC = "insert your stakeholder 3 (User C) address here"
const stakeholderCpk = "insert your stakeholder 3 (User C) private key here"

// CHANNEL PARAMETERS
const channel_id = "insert your channel id here"
const open_amount = new BN('insert open channel amount in wei');
const join_amount = new BN('insert join channel amount in wei');
const tx_amount = new BN('insert transaction amount in wei');

// ON-CHAIN EXPERIMENT PARAMETERS
const num_of_tx_to_be_tested = // insert the number of transactions to be tested here; (usualy 10)
```

To start **on-chain** part of the experiment, inside folder, run:

```
node .\experiment\experiment-on-chain-scenario.js
```

Based on results, set values in .\experiment\configuration.js
```
// ON-CHAIN TIMESTAMPS OF TRANSACTIONS
const intermediate_times = [
// insert the timestamps of the transactions here
];
```

To start event listener, inside folder, run:

```
node .\payment-channel-service\join-event-listener.js
```

**(only once!)** To initialize OCCaaS with an Oracle account, uncomment the following lines, and inside the folder, run:

```
const oracle_tx = await modify_oracle.main(oracle, oraclepk);
console.log(oracle_tx);

node .\experiment\experiment-off-chain-scenario.js
```

**(in multiple rounds)** To run **off-chain** part of the experiment, inside folder, comment and uncomment relevant (for order see below) lines of code, and run:

```
node .\experiment\experiment-off-chain-scenario.js 
```

Order of the off-chain experiment steps, denoting which lines of code above specified comment should be uncommented when running the off-chain experiment command (in rounds)
```
1. // ------- Stakeholder A opens the channel -------- //
2. // ------- Stakeholder B joins the channel -------- // 
3. // ------- Stakeholder A performs 10 "on-chain txs" off-chain txs towards Stakeholder B -------- //
4. // ------- Stakeholder B invites Stakeholder C -------- //
5. // ------- Stakeholder A leaves the channel -------- //
6. // ------- Stakeholder C joins the channel -------- //
7. // ------- Stakeholder B performs 2 off-chain txs towards Stakeholder C -------- //
8. // ------- Stakeholder C leaves the channel -------- //
9. // ------- Stakeholder B leaves the channel -------- //
```

In case OCCaaS's event listener fails to catch Stakeholder B joining the off-chain channel event, uncomment and run.
```
 /*
Stakeholder B joins the channel (Uncomment if "listener" didn't catch "join" event).
// await join_client_reclaim.main(channel_id, stakeholder2, stakeholder2pk, join_amount);
// console.log("Channel B joined the channel");
*/
```

or

In case OCCaaS's event listener fails to catch Stakeholder c joining the off-chain channel event, uncomment and run.
```
/*
Stakeholder C joins the channel (Uncomment if "listener" didn't catch "join" event).
// await join_client_reclaim.main(channel_id, stakeholder3, stakeholder3pk, join_amount);
// console.log("Stakeholder C joined the channel");
*/
```
