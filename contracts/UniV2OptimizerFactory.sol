// "SPDX-License-Identifier: UNLICENSED"

pragma solidity ^0.8.0;

import "./UniV2Optimizer.sol";

contract UniV2OptimizerFactory is Ownable {
    address[] public uniV2Optimizers;
    Strategy[] public strategies;

    struct Strategy {
        uint256 poolId;
        address tokenA;
        address tokenB;
        address staking;
        address reward;
        address stakingRewardAddr;
        address uniV2RouterAddr;
    }
    
    mapping(address => address[]) public uniV2OptimizerByOwner; 
    mapping(uint256 => address) public factoryOptimizers; 

    function createUniV2Optimizer(uint256 _poolId) external returns(address newUniV2Optimizer) {
        Strategy memory strategy = strategies[_poolId];
        UniV2Optimizer uniV2Optimizer = new UniV2Optimizer(
            strategy.tokenA,
            strategy.tokenB,
            strategy.staking,
            strategy.reward,
            strategy.stakingRewardAddr,
            strategy.uniV2RouterAddr
        );
        uniV2Optimizers.push(address(uniV2Optimizer));
        uniV2OptimizerByOwner[msg.sender].push(address(uniV2Optimizer));
        uniV2Optimizer.transferOwnership(msg.sender);
        return address(uniV2Optimizer);
    }
// COMMENTED TO SAVE ON CONTRACT SIZE --> To consider if really needed (alternative offchain solution)
    //function harvestAll() external {
    //    require(uniV2OptimizerByOwner[msg.sender].length > 0);
    //    address[] memory ownerUniV2Optimizers = uniV2OptimizerByOwner[msg.sender];
    //    for (uint i = 0; i < ownerUniV2Optimizers.length; i++) {
    //        UniV2Optimizer(ownerUniV2Optimizers[i]).harvest();
    //    }
    //}

    function addStrategy(
        address _tokenA,
        address _tokenB,
        address _staking,
        address _reward,
        address _stakingRewardAddr,
        address _uniV2RouterAddr
    ) external onlyOwner returns(uint256){
        Strategy memory newStrategy;
        address factoryOptimizer;

        // Populate the strategy struct with requested details
        newStrategy.poolId = strategies.length;
        newStrategy.tokenA = _tokenA;
        newStrategy.tokenB = _tokenB;
        newStrategy.staking = _staking;
        newStrategy.reward = _reward;
        newStrategy.stakingRewardAddr = _stakingRewardAddr;
        newStrategy.uniV2RouterAddr = _uniV2RouterAddr;

        // add the new strategy to the contract storage of strategies 
        strategies.push(newStrategy);

        // create the first optimizer of this strategy, belonging to the Factory itself.
        factoryOptimizer = this.createUniV2Optimizer(newStrategy.poolId);

        // register the optimizer address of the factory's optimizer
        factoryOptimizers[newStrategy.poolId] = factoryOptimizer;
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

    function getFactoryOptimizerByStrategyID(uint256 _poolId) external view returns(address){
        return factoryOptimizers[_poolId];
    }
}



