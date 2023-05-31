const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider/dist');
const contract = require("@truffle/contract");
const contractArtifact = require("../build/contracts/PaymentChannel.json");

const oracle_channel = require("../payment-channel-service/oracle.js")
const configuration = require("./configuration.js")

const main = async (channel_id, sender, invited_stakeholders, sender_pk, open_amount) => {

    try {

        console.log(sender + ' opening channel with id: ', channel_id, ' and amount: ', open_amount, ' wei', ' and stakeholders: ', invited_stakeholders);

        const provider = new HDWalletProvider(sender_pk, configuration.RPC_ENCPOINT);
        const PaymentChannel = contract(contractArtifact);
        PaymentChannel.setProvider(provider);
        const web3 = new Web3(provider)
        const contract_instance = await PaymentChannel.deployed();

        // Static variables
        const prev_state = "0";
        const action = 1;

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
                "balance": open_amount.toString()
            }
        ];

        const open_token_data_encoded = web3.eth.abi.encodeParameters(
            ['uint8', 'string', struct_schema, 'address'],
            [action, channel_id, struct_data, sender]
        );

        const sig_sender_open = web3.eth.accounts.sign(open_token_data_encoded, sender_pk);

        const open_token_data_sender_signed = web3.eth.abi.encodeParameters(
            ['bytes', 'string', 'bytes'],
            [open_token_data_encoded, prev_state, sig_sender_open.signature]
        );

        let open_token_encoded = await oracle_channel.open(open_token_data_sender_signed);

        let open_token_decoded = web3.eth.abi.decodeParameters(
            [
                { type: 'bytes', name: 'data' },
                { type: 'string', name: 'state_prev' },
                { type: 'bytes', name: 'sender_sig' },
                { type: 'bytes', name: 'oracle_sig' },
            ], open_token_encoded
        );

        let token_signer = web3.eth.accounts.recover(open_token_data_encoded, open_token_decoded.oracle_sig);

        let token_signer_signer = web3.eth.accounts.recover(open_token_data_encoded, open_token_decoded.sender_sig);

        if (await contract_instance.oracle_list(token_signer, { from: sender }) == false) {
            console.log('Verification of oracle signature failed!')
            return new Error('Verification of oracle signature failed')
        }

        const tx = await contract_instance.openChannel(open_token_encoded, invited_stakeholders, { value: open_amount, from: sender });
        console.log('Transaction hash: ' + tx.tx);
        return Promise.resolve(tx.tx);

    } catch (error) {
        console.log(error)
        return Promise.reject(error);
    }

}

module.exports = {
    main
}
