const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider/dist');
const contract = require("@truffle/contract");
const contractArtifact = require("../build/contracts/PaymentChannel.json");

const oracle_channel = require("../payment-channel-service/oracle.js")
const configuration = require("./configuration.js")

const main = async (channel_id, sender, sender_pk, amount) => {

    try {

        console.log(sender + ' joining channel with id: ', channel_id, ' and amount: ', amount, ' wei');

        const provider = new HDWalletProvider(sender_pk, configuration.RPC_ENCPOINT);
        const PaymentChannel = contract(contractArtifact);
        PaymentChannel.setProvider(provider);
        const web3 = new Web3(provider)

        // Static variables
        const prev_state = "0";
        const action = 2;

        const struct_schema = {
            "name": "state",
            "type": "tuple[]",
            "components": [
                { name: "address", type: 'address' },
                { name: "balance", type: 'uint256' }
            ]
        };

        const struct_data = [
            {
                "address": sender,
                "balance": amount.toString()
            }
        ];

        const contractInstance = await PaymentChannel.deployed();
       
        const join_token_data_encoded = web3.eth.abi.encodeParameters(
            ['uint8', 'string', struct_schema, 'address'],
            [action, channel_id, struct_data, sender]
        );

        const sig_sender_join = web3.eth.accounts.sign(join_token_data_encoded, sender_pk);

        let join_token_data_sender_signed = web3.eth.abi.encodeParameters(
            ['bytes', 'string', 'bytes'],
            [join_token_data_encoded, prev_state, sig_sender_join.signature]
        );

        let join_token_encoded = await oracle_channel.join(join_token_data_sender_signed);

        let join_token_decoded = web3.eth.abi.decodeParameters(
            [
                { type: 'bytes', name: 'data' },
                { type: 'string', name: 'state_prev' },
                { type: 'bytes', name: 'sender_sig' },
                { type: 'bytes', name: 'oracle_sig' },
            ], join_token_encoded
        );

        const token_signer = web3.eth.accounts.recover(join_token_data_encoded, join_token_decoded.oracle_sig);

        // console.log('Checking if oracle is on (smart contract) list: ', token_signer);
        if (await contractInstance.oracle_list(token_signer, { from: sender }) == false) {
            console.log('Verification of oracle signature failed!')
            return new Error('Verification of oracle signature failed')
        }

        const tx = await contractInstance.joinChannel(join_token_encoded, { from: sender, value: amount });
        console.log('Transaction hash: ', tx.tx);
        return Promise.resolve(tx.tx)

    } catch (error) {
        console.log('Error: ', error)
        return Promise.reject(error)
    }

}

module.exports = {
    main
}
