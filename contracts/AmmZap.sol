pragma solidity ^0.8.0;

import 'openzeppelin-solidity/contracts/utils/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/utils/Context.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol';


interface IUniswapV2Router {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
    
    function swapExactTokensForTokens(
        uint amountIn, 
        uint amountOutMin, 
        address[] calldata path, 
        address to, 
        uint deadline
    ) external returns (uint[] memory amounts);
}


contract AmmZap {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 constant MAX_INT = 2**256 - 1;

    address public ammRouterAddr;

    /**
     * @dev Initializes the zapper contract for a given XYK type AMM
     */
    constructor(address _ammRouterAddr) {
        ammRouterAddr = _ammRouterAddr;        
    }

    function zap(address _tokenToZap, address _tokenA, address _tokenB, uint256 _amountToZap) external {
        require(IERC20(_tokenToZap).balanceOf(address(msg.sender)) >= _amountToZap);
        IERC20(_tokenToZap).safeTransferFrom(msg.sender, address(this), _amountToZap);
        IERC20(_tokenToZap).safeApprove(ammRouterAddr, _amountToZap); 
        IERC20(_tokenA).safeApprove(ammRouterAddr, 0);        
        IERC20(_tokenA).safeApprove(ammRouterAddr, MAX_INT);     
        IERC20(_tokenB).safeApprove(ammRouterAddr, 0);       
        IERC20(_tokenB).safeApprove(ammRouterAddr, MAX_INT);        
        if(_tokenToZap != _tokenA){
            _swapToken(_tokenToZap, _tokenA, _amountToZap.div(2));
        }
        if(_tokenToZap != _tokenB){
            _swapToken(_tokenToZap, _tokenB, _amountToZap.div(2));
        }
        _addLiquidity(_tokenA, _tokenB);
        IERC20(_tokenA).safeApprove(ammRouterAddr, 0);        
        IERC20(_tokenB).safeApprove(ammRouterAddr, 0);
    }


    function _swapToken(address _tokenIn, address _tokenOut, uint256 _amount) internal {
        address[] memory path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;
        IUniswapV2Router(ammRouterAddr).swapExactTokensForTokens(
            _amount,
            0,
            path,
            address(this),
            block.timestamp.add(600)
        );
    }

    
    function _addLiquidity(address _tokenA, address _tokenB) internal {
    uint256 balanceA = IERC20(_tokenA).balanceOf(address(this));
    uint256 balanceB = IERC20(_tokenB).balanceOf(address(this));
    IUniswapV2Router(ammRouterAddr).addLiquidity(
        address(IERC20(_tokenA)),
        address(IERC20(_tokenB)),
        balanceA,
        balanceB,
        1,
        1,
        msg.sender,
        block.timestamp.add(600)
    );
    }


}