const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider/dist');

const contract = require("@truffle/contract");
const contractArtifact = require("../build/contracts/PaymentChannel.json");
const BN = Web3.utils.BN;

const oracle_channel = require("../payment-channel-service/oracle.js")
const state_helper = require('./utils/state-helper-client.js');
const configuration = require("./configuration.js")

const main = async (channel_id, sender, amount, receiver, sender_pk) => {

    try {

        const provider = new Web3.providers.HttpProvider(configuration.RPC_ENCPOINT)
        const PaymentChannel = contract(contractArtifact);
        PaymentChannel.setProvider(provider);
        const web3 = new Web3(provider)
        const action = 3; // update

        const struct_schema = {
            "name": "state",
            "type": "tuple[]",
            "components": [
                { name: "address", type: 'address' },
                { name: "balance", type: 'uint256' }
            ]
        };
        
        // // determine last state of stakeholders
        const current_state = await state_helper.get_last_channel_state(channel_id);

        // determine if both of stakeholders are part of channel (off-chain and on-chain)
        if (!current_state.find((item) => item.address === sender)) {
            console.log('Sender not part of channel (off-chain)!')
            return Promise.reject('Sender not part of channel!');
        }

        if (!current_state.find((item) => item.address === receiver)) {
            console.log('Receiver not part of channel (off-chain)!')
            return Promise.reject('Receiver not part of channel!');
        }

        // determine if sender has enough balance
        const sender_balance = current_state.find((item) => item.address === sender).balance;
        const receiver_balance = current_state.find((item) => item.address === receiver).balance;

        if (parseInt(sender_balance) < parseInt(amount).toString()) {
            console.log('Insufficient funds!', sender_balance, amount.toString())

            return Promise.reject('Insufficient funds!');
        }

        const sender_balance_new = (parseInt(sender_balance) - parseInt(amount)).toString();
        const receiver_balance_new = (parseInt(receiver_balance) + parseInt(amount)).toString();

        const sender_index = current_state.findIndex((item) => item.address === sender);
        const receiver_index = current_state.findIndex((item) => item.address === receiver);

        current_state[sender_index].balance = sender_balance_new;
        current_state[receiver_index].balance = receiver_balance_new;

        // console.log('New state:', current_state)

        let tx_data_encoded = web3.eth.abi.encodeParameters(
            ['uint8', 'string', struct_schema, 'address'],
            [action, channel_id, current_state, sender]
        );

        // sign the data
        const sig_sender_tx = web3.eth.accounts.sign(tx_data_encoded, sender_pk);

        // prepare data to be signed
        const tx_encoded = web3.eth.abi.encodeParameters(
            ['bytes', 'bytes'],
            [tx_data_encoded, sig_sender_tx.signature]
        );

        // call oracle with tx_encoded
        await oracle_channel.update(tx_encoded, sender, amount, receiver)
        return Promise.resolve(true)

    } catch (error) {
        console.log('Error: ', error)
        return Promise.reject(error)
    }

};

module.exports = {
    main
}