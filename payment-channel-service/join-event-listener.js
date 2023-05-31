const Web3 = require('web3');
const contract = require("@truffle/contract");
const contractArtifact = require("../build/contracts/PaymentChannel.json");
const BN = Web3.utils.BN;

const ipfs_helper = require('./utils/ipfs-helper-oracle.js');
const configuration = require("./configuration")

const provider = new Web3.providers.WebsocketProvider(configuration.WS_ENCPOINT);

const web3 = new Web3(provider)

const PaymentChannel = contract(contractArtifact);
PaymentChannel.setProvider(provider);

async function main() {

    try {
        const struct_schema = {
            "name": "state",
            "type": "tuple[]",
            "components": [
                { name: "address", type: 'address' },
                { name: "balance", type: 'uint256' }
            ]
        };
    
        const contractInstance = await PaymentChannel.deployed();
    
        console.log("Oracle event listener is running...");
        console.log("Listening for events on contract: ", contractInstance.address);
    
        await web3.eth.subscribe('logs', {
            address: contractInstance.address,
            topics: ['0x8bcbf84e99a3dc62540fa7c1743c5201d6192a95b0e3ada10bbe0cea9e74fede'] // join channel event
        }, function (error, result) {
            if (!error) {
                console.log('got result');
            } else console.log(error);
        }).on("data", async function (log) { // react here
    
            const decoded_tx = web3.eth.abi.decodeLog([
                { type: 'string', name: 'channel_id', indexed: true },
                { type: 'bytes', name: 'join_token' },
            ], log.data, log.topics.slice(1)
            );
    
            console.log('event - channel_id: ', decoded_tx.channel_id);
            console.log('event - join_token: ', decoded_tx.join_token);
    
            let join_token_decoded = web3.eth.abi.decodeParameters(
                [
                    { type: 'bytes', name: 'data' },
                    { type: 'string', name: 'state_prev' },
                    { type: 'bytes', name: 'sender_sig' },
                    { type: 'bytes', name: 'oracle_sig' },
                ], decoded_tx.join_token
            );
    
            let join_data_decoded = web3.eth.abi.decodeParameters(
                [
                    { type: 'uint8', name: 'action' },
                    { type: 'string', name: 'channel_id' },
                    struct_schema,
                    { type: 'address', name: 'sender' },
                ], join_token_decoded.data
            );
    
            console.log('Join token tx. action:', join_data_decoded.action)
            console.log('Join token tx. channel_id:', join_data_decoded.channel_id)
            console.log('Join token tx. state:', join_data_decoded.state)
            console.log('Join token tx. sender:', join_data_decoded.sender)
            console.log('Join token tx. prev_state:', join_token_decoded.state_prev)
            console.log('Join token tx. sender_sig:', join_token_decoded.sender_sig)
            console.log('Join token tx. oracle_sig:', join_token_decoded.oracle_sig)
    
    
            // determine last IPFS state
            const prev_state_cid = await ipfs_helper.resolve_cid_ipns(join_data_decoded.channel_id);
            console.log('prev_state:', prev_state_cid);
    
            // encode join off-chain tx. with prev_state
            let join_token_encoded = web3.eth.abi.encodeParameters(
                ['bytes', 'string', 'bytes', 'bytes'],
                [join_token_decoded.data, prev_state_cid, join_token_decoded.sender_sig, join_token_decoded.oracle_sig]
            );

            console.log('join_token_encoded:', join_token_encoded)
    
            // update ipns/ipfs
            // IPFS + IPNS stuff
            console.log("Storing it in IPFS");
            const res_store = await ipfs_helper.store_data_ipfs(join_token_encoded);
            console.log(res_store);
            console.log("Publishing it to IPNS");
            const res_publish = await ipfs_helper.publish_ipns(join_data_decoded.channel_id, res_store);
            console.log(res_publish);
            console.log("Join channel completed successfully");
        });
    } catch (error) {
        console.log(error);
    }

}

main();
