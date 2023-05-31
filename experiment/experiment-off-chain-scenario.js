const marky = require('marky');

const open_client = require("../payment-channel-client/open-channel-client.js");
const join_client = require("../payment-channel-client/join-channel-client.js");
const join_client_reclaim = require("../payment-channel-client/join-channel-client-reclaim.js");
const tx_client = require("../payment-channel-client/update-channel-client.js");
const leave_client = require("../payment-channel-client/leave-channel-client.js");
const invite_client = require("../payment-channel-client/invite-channel-client.js");

const modify_oracle = require("../payment-channel-service/modify-oracle.js");

const configuration_oracle = require("../payment-channel-service/configuration.js");
const configuration_experiment = require("./configuration.js");

// Provide credentials of stakeholders and oracle (for testing/experiment/simulation purposes only)
const oracle = configuration_oracle.oracle
const oraclepk = configuration_oracle.oraclepk
const stakeholderA = configuration_experiment.stakeholderA
const stakeholderApk = configuration_experiment.stakeholderApk
const stakeholderB = configuration_experiment.stakeholderB
const stakeholderBpk = configuration_experiment.stakeholderBpk
const stakeholderC = configuration_experiment.stakeholderC
const stakeholderCpk = configuration_experiment.stakeholderCpk

// Insert channel information
const channel_id = configuration_experiment.channel_id;
const open_amount = configuration_experiment.open_amount;
const join_amount = configuration_experiment.join_amount;
const tx_amount = configuration_experiment.tx_amount;

const invited_stakeholders = configuration_experiment.invited_stakeholders;
const intermediate_times = configuration_experiment.intermediate_times;

const test_case = async (channel_id, sender, receiver, tx_amount, senderpk, test_time) => {
    try {
        let number_of_transactions = 0;
        marky.mark("offchain");
        while (true) {
            if (marky.stop("offchain").duration < test_time) {
                await tx_client.main(channel_id, sender, tx_amount, receiver, senderpk);
                number_of_transactions += 1;
            } else
                break;
        }
        return Promise.resolve(number_of_transactions);
    } catch (error) {
        return Promise.reject(error);
    }
}

// Uncomment 
const main = async () => {

    try {
        // -------  Initialize oracle address (only first time) -------- //
        //  const oracle_tx = await modify_oracle.main(oracle, oraclepk);
        //  console.log(oracle_tx);

        // ------- Stakeholder A opens the channel -------- //
        //  await open_client.main(channel_id, stakeholderA, invited_stakeholders, stakeholderApk, open_amount);
        //  console.log("Channel opened");

        // ------- Stakeholder B joins the channel -------- //
        //  await join_client.main(channel_id, stakeholderB, stakeholderBpk, join_amount);

        /*
        Stakeholder B joins the channel (Uncomment if "listener" didn't catch "join" event).
        // await join_client_reclaim.main(channel_id, stakeholder2, stakeholder2pk, join_amount);
        // console.log("Channel B joined the channel");
        */

        // ------- Stakeholder A performs 10 "on-chain txs" off-chain txs towards Stakeholder B -------- //
        //  let number_of_transactions_total = 0;
        //  let last_time = 0;
        //  for (const time of intermediate_times) {
        //      const run_time = time - last_time;
        //      last_time = time;
        //      const number_of_performed_transactions = await test_case(channel_id, stakeholderA, stakeholderB, tx_amount, stakeholderApk, run_time);
        //      number_of_transactions_total += number_of_performed_transactions;
        //      console.log(number_of_transactions_total)
        //  }
        //  console.log('Number of performed transactions: ', number_of_transactions_total);

        // ------- Stakeholder B invites Stakeholder C -------- //
        //  await invite_client.main(channel_id, stakeholderB, stakeholderBpk, stakeholderC);
        //  console.log("Stakeholder B invited Stakeholder C");

        // ------- Stakeholder A leaves the channel -------- //
        //  await leave_client.main(channel_id, stakeholderA, stakeholderApk);
        //  console.log("Stakeholder A left the channel");

        // ------- Stakeholder C joins the channel -------- //
        //  await join_client.main(channel_id, stakeholderC, stakeholderCpk, join_amount);
        //  console.log("Stakeholder C joined the channel");

        /*
         Stakeholder C joins the channel (Uncomment if "listener" didn't catch "join" event).
        // await join_client_reclaim.main(channel_id, stakeholder3, stakeholder3pk, join_amount);
        // console.log("Stakeholder C joined the channel");
        */

        // ------- Stakeholder B performs 2 off-chain txs towards Stakeholder C -------- //
        //  await tx_client.main(channel_id, stakeholderB, tx_amount, stakeholderC, stakeholderBpk);
        //  await tx_client.main(channel_id, stakeholderB, tx_amount, stakeholderC, stakeholderBpk);
        //  console.log('Off chain txs perfomed');

        // ------- Stakeholder C leaves the channel -------- //
        // await leave_client.main(channel_id, stakeholderC, stakeholderCpk);
        // console.log("Stakeholder 3 left the channel");

        // ------- Stakeholder B leaves the channel -------- //
        // await leave_client.main(channel_id, stakeholderB, stakeholderBpk);
        // console.log("Stakeholder 2 left the channel");
    } catch (error) {
        console.log(error);
    }
}

module.exports = {
    main
}

main();


