import React from 'react';
import PropTypes from 'prop-types';

import TemplateList from './TemplateList'
import Settings from './Settings'
import NavBar from './NavBar'
import Stats from './Stats'
import styles from './styles'

import { withStyles } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';
import Typography from '@material-ui/core/Typography';
import Divider from '@material-ui/core/Divider';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';


function distance(pos1, pos2){
	return Math.sqrt((pos1.x - pos2.x)**2 + (pos1.y - pos2.y)**2);
}

function getMousePos(canvas, evt) {
	let rect = canvas.getBoundingClientRect();
	return {
		x: evt.clientX - rect.left
		, y: evt.clientY - rect.top
	};
}

class MainGrid extends React.Component{
	constructor(props){
		super(props)
		this.state = {
			'curTemplate': null
			, 'guideImage': new Image()
			, 'templateImage': new Image()
			, 'oneStroke': true
			, 'showTemplate': false
			, 'firstStroke': true
			, 'mouseDown': false
			, 'lastMousePos': null
			, 'lastScore': 0
			, 'allScores': []
		}

		//window.localStorage.clear()
		let allScores = JSON.parse(window.localStorage.getItem('allScores'))
		if(allScores){
			for(let score of allScores){
				score.date = new Date(score.date)
			}
		}else{
			allScores = []
		}
		this.state.allScores = allScores
	}

	componentDidMount = () => {
		let c = document.getElementById('drawingArea');
		c.addEventListener('mousedown', this.mouseDownListener)
		c.addEventListener('mouseup', this.mouseUpListener)
		c.addEventListener('mousemove', this.mouseMoveListener)
	}

	mouseDownListener = (evt) => {
		let c = document.getElementById('drawingArea')
		this.mouseDown = true;
		if(this.state.firstStroke || this.state.oneStroke){
			this.resetCanvas()
		}
		this.setState({firstStroke: false, lastMousePos:getMousePos(c, evt)})
	}

	mouseUpListener = (evt) => {
		this.mouseDown = false;  
		if(this.state.oneStroke){
			this.evaluate()
			this.drawTemplate();
		}
	}
	mouseMoveListener = (evt) => {
		if (this.mouseDown) {
			let c = document.getElementById('drawingArea');
			let ctx = c.getContext('2d');
			const mousePos = getMousePos(c, evt);
			ctx.beginPath();
			ctx.moveTo(this.state.lastMousePos.x, this.state.lastMousePos.y);
			ctx.lineTo(mousePos.x, mousePos.y);
			ctx.lineWidth = 2;
			ctx.strokeStyle = '#009900';
			ctx.stroke();

			this.setState({lastMousePos: mousePos})
		}
	}

	evaluate = () => {
		this.setState({firstStroke: true})
		this.drawTemplate();
		this.setLastScore(this.score())
	}

	setLastScore = (val) => {
		let allScores = this.state.allScores.slice(0)
		if(isFinite(val)){
			allScores.unshift({
				'score':val
				, 'date': Date.now()
				, 'template': this.state.curTemplate.dirname
			})
			window.localStorage.setItem('allScores', JSON.stringify(allScores))
		}
		this.setState({lastScore: val, allScores: allScores})
	}
	setTemplate = (val) => {
		let templateImage = this.state.templateImage
		let guideImage = this.state.guideImage
		templateImage.src = '/templates/' + val.dirname + '/template.png';
		guideImage.src = '/templates/' + val.dirname + '/guide.png';
		const guideImageLoaded = new Promise(function(resolve, reject){
			guideImage.onload = ()=>resolve()
		});
		const templateImageLoaded = new Promise(function(resolve, reject){
			templateImage.onload = ()=>resolve()
		});
		Promise.all([guideImageLoaded, templateImageLoaded]).then(()=>{
			this.setState({curTemplate: val
				, templateImage: templateImage
				, guideImage: guideImage
				, oneStroke: val.onestroke
			}, this.resetCanvas)
		})
	}
	setOneStroke = (val) => {
		this.setState({oneStroke: val}, this.resetCanvas)
	}
	setShowTemplate = (val) => {
		this.setState({showTemplate: val}, this.resetCanvas)
	}
	clearAllHistory = () => {
		window.localStorage.setItem('allScores', JSON.stringify([]))
		this.setState({allScores: []})
	}
	clearThisHistory = () => {
		let oldScores = this.state.allScores
		let newScores = oldScores.filter(score => score.template !== this.state.curTemplate.dirname)
		window.localStorage.setItem('allScores', JSON.stringify(newScores))
		this.setState({allScores: newScores})
	}

	resetCanvas = () => {
		this.setState({firstStroke: true})
		this.clearCanvas()
		this.drawGuide()
	}
	clearCanvas = () => {
		let c = document.getElementById('drawingArea')
		let ctx = c.getContext('2d')
		ctx.clearRect(0, 0, c.width, c.height);
	}
	drawGuide = () => {
		let c = document.getElementById('drawingArea')
		let ctx = c.getContext('2d')
		ctx.drawImage(this.state.guideImage, 0, 0);
		if(this.state.showTemplate){
			this.drawTemplate()
		}
	}
	drawTemplate = () => {
		let ctx = document.getElementById('drawingArea').getContext('2d')
		ctx.drawImage(this.state.templateImage, 0, 0);
	}

	score = () => {
		let canvas = document.getElementById('drawingArea')
		let ctx = canvas.getContext('2d')

		// create a hidden canvas to draw the template image on
		let templateCanvas = document.createElement("canvas");
		templateCanvas.width = this.state.templateImage.width;
		templateCanvas.height = this.state.templateImage.height;
		let templateCtx = templateCanvas.getContext("2d");
		templateCtx.drawImage(this.state.templateImage, 0, 0);

		let templateImageData = templateCtx.getImageData(0,0,500,500);
		let imageData = ctx.getImageData(0,0,500,500);

		// get position of template pixels
		let templatePositions = []
		for(let j=0; j < templateImageData.data.length; j+= 4){
			if(templateImageData.data[j] === (9*16+9)){
				templatePositions.push({'x': (j/4)%500, 'y': Math.floor((j/4)/500)})
			}
		}

		// get position of drawn pixels
		let drawnPositions = []
		for(let j=1; j < imageData.data.length; j+= 4){
			if(imageData.data[j] === (9*16+9)){
				drawnPositions.push({'x': (j/4)%500, 'y': Math.floor((j/4)/500)})
			}
		}

		// compute distances between template and drawing 
		let tloss = 0;
		for(let tpos of templatePositions){
			let smallestDist = Number.MAX_VALUE;
			for(let dpos of drawnPositions){
				let d = distance(dpos, tpos);
				if(d < smallestDist){
					smallestDist = d;
				}
			}
			tloss += smallestDist;
		}
		let dloss = 0
		for(let dpos of drawnPositions){
			let smallestDist = Number.MAX_VALUE;
			for(let tpos of templatePositions){
				let d = distance(dpos, tpos);
				if(d < smallestDist){
					smallestDist = d;
				}
			}
			dloss += smallestDist;

		}
		return(tloss/templatePositions.length + dloss/templatePositions.length);
	}

	render = () => {
		const {classes} = this.props;
		return(
			<div className={classes.root}>
				<NavBar/>
				<Drawer 
					variant="permanent"
					anchor="left"
					classes={{paper:classes.leftDrawerPaper}}
				>
					<div className={classes.toolbar} />
					<TemplateList 
						setTemplate={this.setTemplate}
						curTemplate={this.state.curTemplate}
					/>
				</Drawer>
				<main className={classes.content}>
					<div className={classes.toolbar} />
						<Card>
							<CardContent>
								<Canvas />
								<Description template={this.state.curTemplate}/>
							</CardContent>
						</Card>
				</main>
				<Drawer 
					variant="permanent"
					anchor="right"
					classes={{paper:classes.rightDrawerPaper}}
				>
					<div className={classes.toolbar} />
					<Divider/>
					<Settings
						oneStroke={this.state.oneStroke}
						showTemplate={this.state.showTemplate}
						setOneStroke={this.setOneStroke}
						setShowTemplate={this.setShowTemplate}
						evaluate={this.evaluate}
						resetCanvas={this.resetCanvas}
					/>
					<Divider/>
					<Stats 
						lastScore={this.state.lastScore}
						allScores={this.state.allScores}
						curTemplate={this.state.curTemplate}
						clearAllHistory={this.clearAllHistory}
						clearThisHistory={this.clearThisHistory}
					/>
				</Drawer>
			</div>
		)
	}
}

function Canvas(){
	return(
		<div>
			<canvas 
				id='drawingArea' 
				width='500' height='500' 
			/>
		</div>
	)
}

function Description(props){
	let description = ''
	if(props.template !== null){
		description = props.template.instructions
	}
	return(
		<Typography align='center' variant='h5'>
			{description}
		</Typography>
	)
}

MainGrid.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(MainGrid);
