// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.8.0;

import "./UniV2Optimizer.sol";
import "./interfaces/IAmmZapFactory.sol";

contract UniV2OptimizerFactory is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Array of addresses of all existing UniV2Optimizer created by the Factory
    address[] public uniV2Optimizers;

    // Address of the AmmZapFactory
    address public ammZapFactory;

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

    // Mapping storing the previous amount of token staked (before dividends payment) of a given Fee Collector
    mapping(address => uint256) public previousFeeCollectorStake;


    constructor(address _ammZapFactory) {
        ammZapFactory = _ammZapFactory;        
    }

    // Create an Optimizer for a given strategy (_poolID).
    function createUniV2Optimizer(uint256 _poolId) external returns(address newUniV2Optimizer) {
        Strategy memory strategy = strategies[_poolId]; 
        // Retrieve the AmmZap associated to the strategy router
        address ammZapAddr =  IAmmZapFactory(ammZapFactory).getAmmZapByRouter(strategy.uniV2RouterAddr);
        UniV2Optimizer uniV2Optimizer = new UniV2Optimizer(
            strategy.stakingRewardAddr,
            strategy.uniV2RouterAddr,
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

    // Compounds the FeeCollector optimizer and pay the dividends to the stakers
    function compoundFeeCollector(address _feeCollector) external {
        UniV2Optimizer(_feeCollector).harvest();
    }

    // Create a new strategy
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

        // Create the first optimizer of this strategy (i.e. the FeeCollector) belonging to the Factory itself.
        feeCollector = this.createUniV2Optimizer(newStrategy.poolId);

        // Register the optimizer address of the FeeCollector
        feeCollectors[newStrategy.poolId] = feeCollector;

        // Initialise the FeeCollector stake to 0
        previousFeeCollectorStake[feeCollector] = 0;

        return newStrategy.poolId;
    }

    function _payDividends(address _feeCollector) external {
        address dividendCurrency = UniV2Optimizer(_feeCollector).staking();
        uint256 currentStake = UniV2Optimizer(_feeCollector).staked();
        uint256 previousStake = previousFeeCollectorStake[_feeCollector];

        if(currentStake > previousStake){
            uint256 dividends = currentStake.sub(previousStake).div(2);
            UniV2Optimizer(_feeCollector).withdraw(dividends);
            IERC20(dividendCurrency).safeTransfer(0x70997970C51812dc3A010C7d01b50e0d17dc79C8, dividends);
        }
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



