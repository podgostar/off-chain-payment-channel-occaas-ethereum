const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider/dist');
const marky = require('marky');

const BN = Web3.utils.BN;
const configuration = require("./configuration.js")

const stakeholderA = configuration.stakeholderA
const stakeholderApk = configuration.stakeholderApk
const stakeholderB = configuration.stakeholderB

const tx_amount = configuration.tx_amount;
const num_of_tx_to_be_tested = configuration.num_of_tx_to_be_tested;

const main = async () => {

    const provider = new HDWalletProvider(stakeholderApk, configuration.RPC_ENCPOINT);
    const web3 = new Web3(provider)
    const gasPrice = await web3.eth.getGasPrice()

    marky.mark("on-chain");
    for (let j = 0; j < num_of_tx_to_be_tested;) {
        const tx = await web3.eth.sendTransaction({ from: stakeholderA, to: stakeholderB, value: tx_amount, gasPrice: gasPrice })
        console.log(tx.transactionHash);
        j++;
        console.log(marky.stop('on-chain').duration)
    }
    console.log("done")

}

module.exports = {
    main
}

main();