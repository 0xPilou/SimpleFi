// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.8.0;

import "./UniV2Optimizer.sol";
import "./interfaces/IAmmZapFactory.sol";

contract UniV2OptimizerFactory {

    // Array of addresses of all existing UniV2Optimizer created by the Factory
    address[] public uniV2Optimizers;

    // Address of the AmmZapFactory
    address public ammZapFactory;

    // Address of the Treasury
    address public treasury;

    // Array of all the Strategies supported by the UniV2OptimizerFactory
    Strategy[] public strategies;

    // Definition of a Strategy : 
    //  - ID of the strategy
    //  - Staking Reward pool contract address
    //  - Router contract address
    struct Strategy {
        uint256 poolId;
        address stakingRewardAddr;
        address uniV2RouterAddr;
    }
    
    // Mapping storing the optimizers addresses of a given user
    mapping(address => address[]) public uniV2OptimizerByOwner; 

    // Mapping storing the FeeCollector address of a given Strategy
    mapping(uint256 => address) public feeCollectors; 

    constructor(address _treasury, address _ammZapFactory) {
        treasury = _treasury;
        ammZapFactory = _ammZapFactory;        
    }

    // Create a new strategy
    function addStrategy(
        address _stakingRewardAddr,
        address _uniV2RouterAddr
    ) external returns(uint256){
        // Can only be called by the Treasury contract
        require(msg.sender == treasury);

        Strategy memory newStrategy;

        // Populate the strategy struct with requested parameters
        newStrategy.poolId = strategies.length;
        newStrategy.stakingRewardAddr = _stakingRewardAddr;
        newStrategy.uniV2RouterAddr = _uniV2RouterAddr;

        // Add the new strategy to the contract strategies storage  
        strategies.push(newStrategy);

        // Create the first optimizer of this strategy (i.e. the FeeCollector) belonging to the Treasury.
        address feeCollector = this.createUniV2Optimizer(newStrategy.poolId);

        // Transfer the ownership of the FeeCollector Optimizer to the Treasury
        UniV2Optimizer(feeCollector).transferOwnership(msg.sender);

        // Register the optimizer address of the FeeCollector
        feeCollectors[newStrategy.poolId] = feeCollector;

////////////////////////////////////////////////////////////////////////
        // Initialise the FeeCollector stake to 0
        //previousFeeCollectorStake[feeCollector] = 0;
////////////////////////////////////////////////////////////////////////

        return newStrategy.poolId;
    }

    // Create an Optimizer for a given strategy (_poolID).
    function createUniV2Optimizer(uint256 _poolId) external returns(address newUniV2Optimizer) {
        
        // Retrieve the AmmZap associated to the strategy router
        address ammZapAddr =  IAmmZapFactory(ammZapFactory).getAmmZapByRouter(strategies[_poolId].uniV2RouterAddr);
        UniV2Optimizer uniV2Optimizer = new UniV2Optimizer(
            strategies[_poolId].stakingRewardAddr,
            strategies[_poolId].uniV2RouterAddr,
            ammZapAddr,
            this.getFeeCollectorByStrategyID(_poolId)
        );
        // Register the newly created optimizer address to the contract storage
        uniV2Optimizers.push(address(uniV2Optimizer));

        // Register the newly created optimizer address for the given user
        uniV2OptimizerByOwner[msg.sender].push(address(uniV2Optimizer));

        // Transfer the Optimizer ownership to the user
        uniV2Optimizer.transferOwnership(msg.sender);

        return address(uniV2Optimizer);
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



