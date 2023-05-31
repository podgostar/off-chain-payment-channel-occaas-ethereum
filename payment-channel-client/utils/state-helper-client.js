const Web3 = require('web3');

const configuration = require("../configuration.js");
const ipfs_helper = require("./ipfs-helper-client.js");

const web3 = new Web3(configuration.RPC_ENCPOINT);

const struct_schema = {
    "name": "state",
    "type": "tuple[]",
    "components": [
        { name: "address", type: 'address' },
        { name: "balance", type: 'uint256' }
    ]
};

async function decode_channel_state(encodedData) {

    const decoded = web3.eth.abi.decodeParameters(
        [
            { type: 'bytes', name: 'data' },
            { type: 'string', name: 'state_prev' },
            { type: 'bytes', name: 'sender_sig' },
            { type: 'bytes', name: 'oracle_sig' },
        ], encodedData
    );

    let data_decoded = web3.eth.abi.decodeParameters(
        [
            { type: 'uint8', name: 'action' },
            { type: 'string', name: 'channel_id' },
            struct_schema,
            { type: 'address', name: 'sender' },
        ], decoded.data
    );

    return Promise.resolve({
        action: data_decoded.action,
        channel_id: data_decoded.channel_id,
        state: data_decoded.state,
        sender: data_decoded.sender,
        state_prev: decoded.state_prev,
        sender_sig: decoded.sender_sig,
        oracle_sig: decoded.oracle_sig
    });

}

async function get_relevant_states(ipfs_cid, states = []) {
    const ipfs_state_encoded = await ipfs_helper.get_data_ipfs(ipfs_cid);
    const state = await decode_channel_state(ipfs_state_encoded);

    if (state.action === '1' || state.action === '3') {
        return [{ action: state.action, state: state.state }, ...states];
    } else {
        return await get_relevant_states(state.state_prev, [{ action: state.action, state: state.state }, ...states]);
    }
}

async function get_last_channel_state(channelid) {
    let state_data = {};

    try {
        const ipfs_cid = await ipfs_helper.resolve_cid_ipns(channelid);
        const all_relevant_states = await get_relevant_states(ipfs_cid);

        all_relevant_states.forEach((curr) => {
            if (curr.action === '1' || curr.action === '3') {
                curr.state.forEach((state) => {
                    state_data[state.address] = state.balance;
                });
            } else if (curr.action === '4') {
                const address = curr.state[0].address;
                if (state_data.hasOwnProperty(address)) {
                    delete state_data[address];
                }
            } else if (curr.action === '2') {
                const address = curr.state[0].address;
                if (state_data.hasOwnProperty(address)) {
                    state_data[address] += curr.state[0].balance;
                } else {
                    state_data[address] = curr.state[0].balance;
                }
            }
        });

        state_data = Object.entries(state_data).map(([address, balance]) => ({ address, balance }));
    } catch (error) {
        console.log(error);
    }

    return state_data;
}

async function parse_channel_state(state) {
    try {
        const state_data = state.reduce((acc, curr) => {
            acc.push({ address: curr.address, balance: curr.balance })
            return acc;
        }, [])
        return Promise.resolve(state_data)
    } catch (error) {
        console.log(error)
        return Promise.resolve(error)
    }

}

module.exports = {
    get_relevant_states,
    get_last_channel_state,
    parse_channel_state
}
