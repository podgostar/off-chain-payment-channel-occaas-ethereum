const Web3 = require('web3');
const BN = Web3.utils.BN;

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

var privateKeys = [
    stakeholderApk,
    stakeholderBpk,
    stakeholderCpk,
];

// CHANNEL PARAMETERS
const channel_id = "insert your channel id here"
const open_amount = new BN('insert open channel amount in wei');
const join_amount = new BN('insert join channel amount in wei');
const tx_amount = new BN('insert transaction amount in wei');

// ON-CHAIN EXPERIMENT PARAMETERS
const num_of_tx_to_be_tested = // insert the number of transactions to be tested here;

// ON-CHAIN TIMESTAMPS OF TRANSACTIONS
const intermediate_times = [
// insert the timestamps of the transactions here
];

// INVITED STAKEHOLDERS (currently only one - stakeholder B)
const invited_stakeholders = [stakeholderB];

module.exports = {
    RPC_ENCPOINT,
    WS_ENCPOINT,
    stakeholderA,
    stakeholderApk,
    stakeholderB,
    stakeholderBpk,
    stakeholderC,
    stakeholderCpk,
    privateKeys,
    host,
    port,
    protocol,
    channel_id,
    open_amount,
    join_amount,
    tx_amount,
    intermediate_times,
    invited_stakeholders,
    num_of_tx_to_be_tested
}