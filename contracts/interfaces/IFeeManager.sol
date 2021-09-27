pragma solidity ^0.8.0;

interface IFeeManager {

    function createStrategy(
        address _uniV2OptmizerFactory,
        address _stakingRewardAddr,
        address _uniV2RouterAddr
    ) external;

    function compoundFeeCollector(
        address _feeCollector
    ) external;
}
