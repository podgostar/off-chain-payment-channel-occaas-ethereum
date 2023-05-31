const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider/dist');
const contract = require("@truffle/contract");
const contractArtifact = require("../build/contracts/PaymentChannel.json");

const ipfs_helper = require('./utils/ipfs-helper-oracle.js');
const state_helper = require('./utils/state-helper-oracle.js');
const configuration = require("./configuration.js")

// Credentials
const oracle = configuration.oracle
const oraclepk = configuration.oraclepk

const provider = new Web3.providers.HttpProvider(configuration.RPC_ENCPOINT)
const web3 = new Web3(provider)
const PaymentChannel = contract(contractArtifact);
PaymentChannel.setProvider(provider);

const struct_schema = {
    "name": "state",
    "type": "tuple[]",
    "components": [
        { name: "address", type: 'address' },
        { name: "balance", type: 'uint256' }
    ]
};

const open = async (open_token_data_sender_signed) => {

    try {

        let sender_open_token_signed_decoded = web3.eth.abi.decodeParameters(
            [
                { type: 'bytes', name: 'data' },
                { type: 'string', name: 'state_prev' },
                { type: 'bytes', name: 'sender_sig' },
            ], open_token_data_sender_signed
        );

        let open_token_data_decoded = web3.eth.abi.decodeParameters(
            [
                { type: 'uint8', name: 'action' },
                { type: 'string', name: 'channel_id' },
                struct_schema,
                { type: 'address', name: 'sender' },
            ], sender_open_token_signed_decoded.data
        );

        // check that channel id (ipns id) does not exists (on IPFS) (it should not exist)
        const ipns_existence = await ipfs_helper.check_and_create_ipns_key(open_token_data_decoded.channel_id);
        if (ipns_existence) {
            return Promise.reject(Error("Channel ID already exists (IPNS)"));
        }

        // Check if channel does not exists (on blockchain) (it should not exist)
        const contract_instance = await PaymentChannel.deployed();
        const channel_instance = await contract_instance.channel_list(open_token_data_decoded.channel_id, { from: oracle });

        if (channel_instance._current_status.toString() != '0') { // 0 = undefined
            return Promise.reject(Error("Channel ID already exists (blockchain)"));
        }

        // Check if prev_state is 0
        if (sender_open_token_signed_decoded.state_prev != '0') {
            console.log("Defined prev_state within token is not 0");
            return Promise.reject(Error("Defined prev_state within token is not 0"));
        }

        const sender_signatureMatch = open_token_data_decoded.sender == web3.eth.accounts.recover(sender_open_token_signed_decoded.data, sender_open_token_signed_decoded.sender_sig);

        // Check if sender is the same as defined in the token (verification of signature)
        if (!sender_signatureMatch) {
            console.log("Sender is not the same as defined in the token");
            return Promise.reject(Error("Sender is not the same as defined in the token"));
        }

        const senderMatch = open_token_data_decoded.sender == open_token_data_decoded.state[0].address;
        const balanceValid = open_token_data_decoded.state[0].balance > '0';
        // Check state defined within token
        if (!senderMatch || !balanceValid) {
            console.log("Sender is not the same as defined in the state or balance is invalid");
            return Promise.reject(Error("Sender is not the same as defined in the state or balance is invalid"));
        }

        const sig_oracle_open = web3.eth.accounts.sign(sender_open_token_signed_decoded.data, oraclepk);

        const open_token_encoded = web3.eth.abi.encodeParameters(
            ['bytes', 'string', 'bytes', 'bytes'],
            [sender_open_token_signed_decoded.data, sender_open_token_signed_decoded.state_prev, sender_open_token_signed_decoded.sender_sig, sig_oracle_open.signature]
        );

        // IPFS + IPNS stuff
        const cid = await ipfs_helper.store_data_ipfs(open_token_encoded);
        await ipfs_helper.publish_ipns(open_token_data_decoded.channel_id, cid);

        return Promise.resolve(open_token_encoded);

    } catch (error) {
        console.log(error);
        return Promise.reject(error);
    }

}

const join = async (join_token_data_sender_signed) => {

    try {

        const contract_instance = await PaymentChannel.deployed();

        let sender_join_token_signed_decoded = web3.eth.abi.decodeParameters(
            [
                { type: 'bytes', name: 'data' },
                { type: 'string', name: 'state_prev' },
                { type: 'bytes', name: 'sender_sig' },
            ], join_token_data_sender_signed
        );

        let join_token_data_decoded = web3.eth.abi.decodeParameters(
            [
                { type: 'uint8', name: 'action' },
                { type: 'string', name: 'channel_id' },
                struct_schema,
                { type: 'address', name: 'sender' },
            ], sender_join_token_signed_decoded.data
        );

        // Check token ACTION
        if (join_token_data_decoded.action != '2') {
            console.log("Defined action within token is not join");
            return Promise.reject(Error("Defined action within token is not join"));
        }

        if (sender_join_token_signed_decoded.state_prev != '0') {
            console.log("Defined prev_state within token is not 0");
            return Promise.reject(Error("Defined prev_state within token is not 0"));
        }

        // Check if channel exists (on blockchain) and if it is opened
        const channel_instance = await contract_instance.channel_list(join_token_data_decoded.channel_id, { from: oracle });
        // console.log('Channel status:', channel_instance._current_status.toString());
        if (channel_instance._current_status.toString() != '1') { // 1 = opened
            return Promise.reject(Error("Channel is not opened or is already closed"));
        }

        // check on blockchain if stakeholder is invited (on blockchain)
        const stakeholder = await contract_instance.getStakeholder(join_token_data_decoded.channel_id, join_token_data_decoded.sender, { from: oracle });
        // console.log('Stakeholder status:', stakeholder._status.toString());
        if (stakeholder._status.toString() != '1') { // 1 = invited
            return Promise.reject(Error("Stakeholder is not invited (blockchain)"));
        }

        // Check if sender is the same as defined in the token
        if (join_token_data_decoded.sender == web3.eth.accounts.recover(sender_join_token_signed_decoded.data, sender_join_token_signed_decoded.sender_sig)) {
            // console.log('Token sender:', join_token_data_decoded.sender)
        } else {
            console.log("Verification of token signature failed, the sender is not the same as defined in the token");
            return Promise.reject(Error("Verification of token signature failed, the sender is not the same as defined in the token"));
        }

        // Check (join token) data
        if (join_token_data_decoded.sender == join_token_data_decoded.state[0].address && join_token_data_decoded.state[0].balance > '0') {
            // console.log('Sender address:', join_token_data_decoded.sender);
            // console.log('Sender balance:', join_token_data_decoded.state[0].balance);
        } else {
            console.log('Sender is not the same as defined in the state');
            return Promise.reject(Error("Sender is not the same as defined in the state"));
        }

        const sig_oracle_join = web3.eth.accounts.sign(sender_join_token_signed_decoded.data, oraclepk);

        let join_token_encoded = web3.eth.abi.encodeParameters(
            ['bytes', 'string', 'bytes', 'bytes'],
            [sender_join_token_signed_decoded.data, sender_join_token_signed_decoded.state_prev, sender_join_token_signed_decoded.sender_sig, sig_oracle_join.signature]
        );

        return Promise.resolve(join_token_encoded);
    } catch (error) {
        console.log(error);
        return Promise.reject(Error("Oracle error"));
    }

}

const join_reclaim = async (join_token) => {


    try {
        const contract_instance = await PaymentChannel.deployed();

        let join_token_decoded = web3.eth.abi.decodeParameters(
            [
                { type: 'bytes', name: 'data' },
                { type: 'string', name: 'state_prev' },
                { type: 'bytes', name: 'sender_sig' },
                { type: 'bytes', name: 'oracle_sig' },
            ], join_token
        );

        let join_token_data_decoded = web3.eth.abi.decodeParameters(
            [
                { type: 'uint8', name: 'action' },
                { type: 'string', name: 'channel_id' },
                struct_schema,
                { type: 'address', name: 'sender' },
            ], join_token_decoded.data
        );

        // check if the channel is opened
        const channel_instance = await contract_instance.channel_list(join_token_data_decoded.channel_id, { from: oracle });

        if (channel_instance._current_status.toString() != '1') { // 1 = opened
            return Promise.reject(Error("Channel is not opened or is already closed"));
        }

        // check that sender performed tx (on blockchain)
        // check on blockchain if stakeholder is invited (on blockchain)
        const stakeholder = await contract_instance.getStakeholder(join_token_data_decoded.channel_id, join_token_data_decoded.sender, { from: oracle });
        // console.log('Stakeholder status:', stakeholder._status.toString());
        if (stakeholder._status.toString() != '2') { // 2 = joined
            return Promise.reject(Error("Stakeholder have not joined yet!"));
        }

        // verify oracle signature
        if (!web3.eth.accounts.recover(join_token_decoded.data, join_token_decoded.oracle_sig) == oracle) {
            console.log("Verification of oracle signature failed");
            return Promise.reject(Error("Verification of oracle signature failed"));
        }

        // get last cid
        const ipfs_cid = await ipfs_helper.resolve_cid_ipns(join_token_data_decoded.channel_id);

        // add cid to last join token
        const join_token_encoded_signed = web3.eth.abi.encodeParameters(
            ['bytes', 'string', 'bytes', 'bytes'],
            [join_token_decoded.data, ipfs_cid, join_token_decoded.sender_sig, join_token_decoded.oracle_sig]
        );

        // add to ipfs
        const res_store = await ipfs_helper.store_data_ipfs(join_token_encoded_signed);
        await ipfs_helper.publish_ipns(join_token_data_decoded.channel_id, res_store);
        return Promise.resolve(true);
    } catch (error) {
        console.log(error);
        return Promise.reject(error);
    }

}

const update = async (tx_token_sender_signed, sender, amount, receiver) => {
    try {
        // at oracle, it should be checked, that no intermeediate tx's was performed in between of "perform_tx_helper" and "perform_tx"

        const contract_instance = await PaymentChannel.deployed();

        const action = 3; // off-chain tx

        const tx_token_sender_decoded = web3.eth.abi.decodeParameters(
            [
                { type: 'bytes', name: 'data' },
                { type: 'bytes', name: 'sender_sig' } 
            ], tx_token_sender_signed
        );

        let tx_token_sender_data_decoded = web3.eth.abi.decodeParameters(
            [
                { type: 'uint8', name: 'action' },
                { type: 'string', name: 'channel_id' },
                struct_schema,
                { type: 'address', name: 'sender' },
            ], tx_token_sender_decoded.data
        );

        // console.log(tx_token_sender_data_decoded.state)
        // check if channel exist
        const channel_exist = ipfs_helper.check_ipns_key(tx_token_sender_data_decoded.channel_id);
        if (!channel_exist) {
            console.log('Channel does not exist!')
            return Promise.reject('Channel does not exist!');
        }

        const current_state = await state_helper.get_last_channel_state(tx_token_sender_data_decoded.channel_id);

        // Check if sender and receiver are part of the "off-chain" channel 
        // i.e., some of them could already request for leave_token, but not yet claimed it on-chain
        if (!current_state.find((item) => item.address === sender)) {
            console.log('Sender not part of channel (off-chain)!')
            return Promise.reject('Sender not part of channel!');
        }

        if (!current_state.find((item) => item.address === receiver)) {
            console.log('Receiver not part of channel (off-chain)!')
            return Promise.reject('Receiver not part of channel!');
        }

        // console.log('Verifying sender signature ')
        let token_signer_sender = web3.eth.accounts.recover(tx_token_sender_decoded.data, tx_token_sender_decoded.sender_sig);

        if (tx_token_sender_data_decoded.action != action) {
            console.log('Action mismatch!')
            return Promise.reject('Action mismatch!');
        }

        if (token_signer_sender !== sender) {
            console.log('Sender signature mismatch!')
            return Promise.reject('Sender signature mismatch!');
        }
        if (token_signer_sender !== tx_token_sender_data_decoded.sender) {
            console.log('Sender signature mismatch!')
            return Promise.reject('Sender signature mismatch!');
        }

        // determine current state based on tx_token_sender_data
        const sender_balance = current_state.find((item) => item.address === sender).balance;
        const receiver_balance = current_state.find((item) => item.address === receiver).balance;
        const sender_balance_new = (parseInt(sender_balance) - parseInt(amount)).toString();
        const receiver_balance_new = (parseInt(receiver_balance) + parseInt(amount)).toString();
        const sender_index = current_state.findIndex((item) => item.address === sender);
        const receiver_index = current_state.findIndex((item) => item.address === receiver);

        // update
        current_state[sender_index].balance = sender_balance_new;
        current_state[receiver_index].balance = receiver_balance_new;


        // parse tx_token_sender_data_decoded.state to match current_state outline
        const state_token_parsed = await state_helper.parse_channel_state(tx_token_sender_data_decoded.state);


        const isEqual = current_state.length === state_token_parsed.length && state_token_parsed.every((element, index) => element === state_token_parsed[index]);
        if (!isEqual) {
            console.log("State mismatch!")
            return Promise.reject('State mismatch!');
        }

        // sign oracle_tx
        const sig_oracle_tx = web3.eth.accounts.sign(tx_token_sender_decoded.data, oraclepk);

        // determine last state of stakeholders
        const ipfs_cid = await ipfs_helper.resolve_cid_ipns(tx_token_sender_data_decoded.channel_id);

        // prepare token 
        const tx_token_encoded_signed = web3.eth.abi.encodeParameters(
            ['bytes', 'string', 'bytes', 'bytes'], // data, state_prev, oracle_sig
            [tx_token_sender_decoded.data, ipfs_cid, tx_token_sender_decoded.sender_sig, sig_oracle_tx.signature]
        );

        // IPFS + IPNS stuff
        const res_store = await ipfs_helper.store_data_ipfs(tx_token_encoded_signed);
        await ipfs_helper.publish_ipns(tx_token_sender_data_decoded.channel_id, res_store);
        return Promise.resolve(true);

    } catch (error) {
        console.log(error);
        return Promise.reject(Error("Oracle - perform tx. error"));
    }
}

const leave = async (leave_token_data_sender_signed) => {
    try {

        const action = 4; // leave

        // console.log("Entering oracle.js open function...")

        let sender_leave_token_signed_decoded = web3.eth.abi.decodeParameters(
            [
                { type: 'bytes', name: 'data' },
                { type: 'bytes', name: 'sender_sig' },
            ], leave_token_data_sender_signed
        );

        let leave_data_decoded = web3.eth.abi.decodeParameters(
            [
                { type: 'uint8', name: 'action' },
                { type: 'string', name: 'channel_id' },
                struct_schema,
                { type: 'address', name: 'sender' },
            ], sender_leave_token_signed_decoded.data
        );

        if (leave_data_decoded.action != action) {
            console.log('Action mismatch!')
            return Promise.reject('Action mismatch!');
        }

        // check that channel id (ipns id) does not exists (on IPFS) (it should not exist)
        const ipns_existence = await ipfs_helper.check_and_create_ipns_key(leave_data_decoded.channel_id);
        if (!ipns_existence) {
            return Promise.reject(Error("Channel ID does not exists (IPNS)"));
        }

        // Check if channel does not exists (on blockchain) (it should not exist)
        const contract_instance = await PaymentChannel.deployed();
        const channel_instance = await contract_instance.channel_list(leave_data_decoded.channel_id, { from: oracle });

        if (channel_instance._current_status.toString() != '1') { // 1 = open
            return Promise.reject(Error("Channel ID already exists (blockchain)"));
        }

        const sig_oracle_leave = web3.eth.accounts.sign(sender_leave_token_signed_decoded.data, oraclepk);

        // determine last state of stakeholders
        const ipfs_cid = await ipfs_helper.resolve_cid_ipns(leave_data_decoded.channel_id);

        const leave_token_encoded = web3.eth.abi.encodeParameters(
            ['bytes', 'string', 'bytes', 'bytes'], // data, state_prev, oracle_sig
            [sender_leave_token_signed_decoded.data, ipfs_cid, sender_leave_token_signed_decoded.sender_sig, sig_oracle_leave.signature]
        );

        // IPFS + IPNS stuff
        const res_store = await ipfs_helper.store_data_ipfs(leave_token_encoded);
        await ipfs_helper.publish_ipns(leave_data_decoded.channel_id, res_store);

        return Promise.resolve(leave_token_encoded);


    } catch (error) {
        console.log(error);
        return Promise.reject(Error("Oracle - leave channel - error"));
    }
}

module.exports = {
    open,
    join,
    update,
    leave,
    join_reclaim
}
