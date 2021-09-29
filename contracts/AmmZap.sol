pragma solidity ^0.8.0;

import 'openzeppelin-solidity/contracts/utils/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/utils/Context.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol';
import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IUniswapV2Router.sol';


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
            _swapToken(_tokenToZap, _tokenA, address(this),  _amountToZap.div(2));
        }

        if(_tokenToZap != _tokenB){
            _swapToken(_tokenToZap, _tokenB, address(this), _amountToZap.div(2));
        }

        _addLiquidity(_tokenA, _tokenB);

        IERC20(_tokenA).safeApprove(ammRouterAddr, 0);        
        IERC20(_tokenB).safeApprove(ammRouterAddr, 0);
    }

    function unzap(address _tokenToUnzap, address _expectedToken, uint256 _amountToUnzap) external {
        require(IERC20(_tokenToUnzap).balanceOf(address(msg.sender)) >= _amountToUnzap);
        
        address tokenA = IUniswapV2Pair(_tokenToUnzap).token0();
        address tokenB = IUniswapV2Pair(_tokenToUnzap).token1();

        IERC20(_tokenToUnzap).safeTransferFrom(msg.sender, address(this), _amountToUnzap);

        IERC20(_tokenToUnzap).safeApprove(ammRouterAddr, _amountToUnzap); 
     
        (uint256 amountA, uint256 amountB) = IUniswapV2Router(ammRouterAddr).removeLiquidity(
            tokenA,
            tokenB,
            _amountToUnzap,
            1,
            1,
            address(this),
            block.timestamp.add(600)
        );
 
        if(tokenA != _expectedToken){
            IERC20(tokenA).safeApprove(ammRouterAddr, 0);        
            IERC20(tokenA).safeApprove(ammRouterAddr, amountA);
            _swapToken(tokenA, _expectedToken, msg.sender, amountA);
        }

        if(tokenB != _expectedToken){
            IERC20(tokenB).safeApprove(ammRouterAddr, 0);       
            IERC20(tokenB).safeApprove(ammRouterAddr, amountB);                   
            _swapToken(tokenB, _expectedToken, msg.sender, amountB);
        }
    }

    function swapLP(address _tokenIn, address _tokenOut, uint256 _amountTokenIn) external {
        require(IERC20(_tokenIn).balanceOf(address(msg.sender)) >= _amountTokenIn);
        address tokenA = IUniswapV2Pair(_tokenOut).token0();
        address tokenB = IUniswapV2Pair(_tokenOut).token1();

        this.unzap(_tokenIn, tokenA, _amountTokenIn);
        this.zap(tokenA, tokenA, tokenB, IERC20(tokenA).balanceOf(address(this)));
        IERC20(_tokenOut).safeTransfer(msg.sender, IERC20(_tokenOut).balanceOf(address(this)));
    }

    function _swapToken(address _tokenIn, address _tokenOut, address _to, uint256 _amount) internal {
        address[] memory path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;
        IUniswapV2Router(ammRouterAddr).swapExactTokensForTokens(
            _amount,
            0,
            path,
            _to,
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