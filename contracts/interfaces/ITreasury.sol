pragma solidity ^0.8.0;

interface ITreasury {

    function createUniV2Strategy(
        address _uniV2OptmizerFactory,
        address _stakingRewardAddr,
        address _uniV2RouterAddr
    ) external;

    function createBeefyStrategy(
        address _beefyOptimizerFactory,
        address _beefyVaultAddr
    ) external;

    function compoundFeeCollector(
        address _feeCollector
    ) external;
}
