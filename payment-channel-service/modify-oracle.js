const contract = require("@truffle/contract");
const contractArtifact = require("../build/contracts/PaymentChannel.json");

const configuration = require("./configuration.js");

const HDWalletProvider = require('@truffle/hdwallet-provider/dist');

const main = async (oracle, oraclePK) => {

    try {
        // Provide HDWalletProvider with private keys and WEB3-RPC endpoint
        const provider = new HDWalletProvider(oraclePK, configuration.RPC_ENCPOINT);
        const PaymentChannel = contract(contractArtifact);
        PaymentChannel.setProvider(provider);

        const contract_instance = await PaymentChannel.deployed();

        if (await contract_instance.oracle_list(oracle, { from: oracle }) == false) {
            const tx = await contract_instance.modify_oracle(oracle, true, { from: oracle });
            console.log("Oracle added to the list");
            Promise.resolve(tx.tx);
        } else {
            console.log("Oracle already in the list");
            Promise.reject("Oracle already in the list");
        }
    } catch (error) {
        console.log(error);
        Promise.reject(error);
    }
}

module.exports = {
    main
}

