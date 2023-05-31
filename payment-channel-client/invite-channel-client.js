const contract = require("@truffle/contract");
const contractArtifact = require("../build/contracts/PaymentChannel.json");

const HDWalletProvider = require('@truffle/hdwallet-provider/dist');

const configuration = require("./configuration.js");

const main = async (channel_id, inviter, inviterPK, invitee) => {

    try {
        // Provide HDWalletProvider with private keys and WEB3-RPC endpoint
        const provider = new HDWalletProvider(inviterPK, configuration.RPC_ENCPOINT);
        const PaymentChannel = contract(contractArtifact);
        PaymentChannel.setProvider(provider);

        const contract_instance = await PaymentChannel.deployed();

        const tx2 = await contract_instance.invite(channel_id, invitee, { from: inviter });
        console.log('Transaction hash: ', tx2.tx)
        Promise.resolve(tx2.tx);
    } catch (error) {
        console.log(error);
        Promise.reject(error);
    }
}

module.exports = {
    main
}

