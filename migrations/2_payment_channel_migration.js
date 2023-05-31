var PaymentChannel = artifacts.require("PaymentChannel");

module.exports = function(deployer) {
  // deployment steps
  deployer.deploy(PaymentChannel);
};