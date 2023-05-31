const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider/dist');
const contract = require("@truffle/contract");
const contractArtifact = require("../build/contracts/PaymentChannel.json");

const oracle_channel = require("../payment-channel-service/oracle.js")
const state_helper = require('./utils/state-helper-client.js');
const configuration = require("./configuration.js")


const main = async (channel_id, sender, sender_pk) => {

    try {

        console.log(sender + ' leaving channel with id: ', channel_id);

        // console.log('Entering "leave-channel-client.js"')
        const provider = new HDWalletProvider(sender_pk, configuration.RPC_ENCPOINT);
        const PaymentChannel = contract(contractArtifact);
        PaymentChannel.setProvider(provider);
        const web3 = new Web3(provider)
        const contract_instance = await PaymentChannel.deployed();
        const action = 4; // leave

        const struct_schema = {
            "name": "state",
            "type": "tuple[]", // [] is denoting array - for single struct, it is not needed, but let's leave it for now
            "components": [
                { name: "address", type: 'address' },
                { name: "balance", type: 'uint256' }
            ]
        };

        // determine last state of stakeholders
        const current_state = await state_helper.get_last_channel_state(channel_id);

        // determine sender current balance
        const sender_balance = current_state.find((item) => item.address === sender).balance;
        // console.log('Sender balance:', sender_balance)

        if (sender_balance < 0) {
            console.log('Insufficient funds!')
            return Promise.reject('Insufficient funds!');
        }

        const struct_data = [
            {
                "address": sender,
                "balance": sender_balance
            }
        ];

        let leave_data_encoded = web3.eth.abi.encodeParameters(
            ['uint8', 'string', struct_schema, 'address'],
            [action, channel_id, struct_data, sender]
        );

        // sign the data
        const sig_sender_leave = web3.eth.accounts.sign(leave_data_encoded, sender_pk);

        // prepare data to be signed
        const leave_encoded_signer = web3.eth.abi.encodeParameters(
            ['bytes', 'bytes'],
            [leave_data_encoded, sig_sender_leave.signature]
        );

        // call oracle with tx_encoded
        const leave_token_encoded_oracle = await oracle_channel.leave(leave_encoded_signer)

        // decode data
        let leave_oracle_decoded = web3.eth.abi.decodeParameters(
            [
                { type: 'bytes', name: 'data' },
                { type: 'string', name: 'state_prev' },
                { type: 'bytes', name: 'sender_sig' },
                { type: 'bytes', name: 'oracle_sig' },
            ], leave_token_encoded_oracle
        );

        // console.log('Verifying oracle signature ')
        let token_signer_oracle = web3.eth.accounts.recover(leave_oracle_decoded.data, leave_oracle_decoded.oracle_sig);
        // console.log('Signer (oracle): ', token_signer_oracle);

        // console.log('Verifying own signature ')
        let token_signer_sender = web3.eth.accounts.recover(leave_oracle_decoded.data, leave_oracle_decoded.sender_sig);
        // console.log('Sender signature: ', token_signer_oracle);

        if (token_signer_sender != sender) {
            console.log('Verification of sender signature failed!')
            return new Error('Verification of sender signature failed')
        }

        // console.log('Checking if oracle is on (smart contract) list: ', token_signer_oracle);
        if (await contract_instance.oracle_list(token_signer_oracle, { from: sender }) == false) {
            console.log('Verification of oracle signature failed!')
            return new Error('Verification of oracle signature failed')
        }

        const tx = await contract_instance.leaveChannel(leave_token_encoded_oracle, { from: sender });
        console.log('Transaction hash: ' + tx.tx);
        return Promise.resolve(tx.tx)

    } catch (error) {
        console.log(error)
        return Promise.reject(error)
    }

}

module.exports = {
    main
}
