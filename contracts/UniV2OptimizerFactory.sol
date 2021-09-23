// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.8.0;

import "./UniV2Optimizer.sol";
import "./interfaces/IAmmZapFactory.sol";

contract UniV2OptimizerFactory is Ownable {
    address[] public uniV2Optimizers;
    address public ammZapFactory;
    Strategy[] public strategies;

    struct Strategy {
        uint256 poolId;
        address stakingRewardAddr;
        address uniV2RouterAddr;
    }
    
    mapping(address => address[]) public uniV2OptimizerByOwner; 
    mapping(uint256 => address) public feeCollectors; 

    constructor(address _ammZapFactory) {
        ammZapFactory = _ammZapFactory;        
    }

    function createUniV2Optimizer(uint256 _poolId) external returns(address newUniV2Optimizer) {
        Strategy memory strategy = strategies[_poolId]; 
        address ammZapAddr =  IAmmZapFactory(ammZapFactory).getAmmZapByRouter(strategy.uniV2RouterAddr);
        UniV2Optimizer uniV2Optimizer = new UniV2Optimizer(
            strategy.stakingRewardAddr,
            strategy.uniV2RouterAddr,
            ammZapAddr,
            this.getFeeCollectorByStrategyID(_poolId)
        );
        uniV2Optimizers.push(address(uniV2Optimizer));
        uniV2OptimizerByOwner[msg.sender].push(address(uniV2Optimizer));
        uniV2Optimizer.transferOwnership(msg.sender);
        return address(uniV2Optimizer);
    }

    function compoundFeeCollectors() external {
        require(strategies.length > 0);
        for (uint i = 0; i < strategies.length; i++) {
            UniV2Optimizer(this.getFeeCollectorByStrategyID(i)).harvest();
        }
    }

    function addStrategy(
        address _stakingRewardAddr,
        address _uniV2RouterAddr
    ) external onlyOwner returns(uint256){
        Strategy memory newStrategy;
        address feeCollector;

        // Populate the strategy struct with requested details
        newStrategy.poolId = strategies.length;
        newStrategy.stakingRewardAddr = _stakingRewardAddr;
        newStrategy.uniV2RouterAddr = _uniV2RouterAddr;

        // Add the new strategy to the contract storage of strategies 
        strategies.push(newStrategy);

        // Create the first optimizer of this strategy, belonging to the Factory itself.
        feeCollector = this.createUniV2Optimizer(newStrategy.poolId);

        // Register the optimizer address of the factory's optimizer
        feeCollectors[newStrategy.poolId] = feeCollector;
        return newStrategy.poolId;
    }

    function getOptimizerCount() external view returns(uint) {
        return uniV2Optimizers.length;
    } 
    
    function getStrategyCount() external view returns(uint) {
        return strategies.length;
    }

    function getOwnerOptimizers(address _owner) external view returns(address[] memory) {
        return uniV2OptimizerByOwner[_owner];
    }

    function getFeeCollectorByStrategyID(uint256 _poolId) external view returns(address){
        return feeCollectors[_poolId];
    }
}



