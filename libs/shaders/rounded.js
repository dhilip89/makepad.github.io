var types = require('base/types')
var painter = require('services/painter')

module.exports = class Rounded extends require('./quad'){

	prototype(){
		this.props = {
			borderColor: [0,0,0,1],
			shadowColor: [0,0,0,0.5],

			borderWidth: [0,0,0,0],
			borderRadius: [8,8,8,8],

			shadowBlur: 0.0,
			shadowSpread: 0.0,
			shadowOffset: [0.0,0.0],
			
			mesh:{kind:'geometry', type:types.vec3},
		}

		this.mesh = new painter.Mesh(types.vec3).push(
			0,0, 0,
			1,0, 0,
			0, 1, 0,
			1, 1, 0
		)
		.push(
			0,0, 1,
			1,0, 1,
			0, 1, 1,
			1, 1, 1
		)
		this.indices = new painter.Mesh(types.uint16)
		this.indices.push(0,1,2,2,1,3,4,5,6,6,5,7)

		this.verbs = {
			$readOffset:function(o){
				var len = this.PROPLEN()
				if(o < 0 || o >= len) return
				return {
					x:this.PROP(o, 'x'),
					y:this.PROP(o, 'y'),
					w:this.PROP(o, 'w'),
					h:this.PROP(o, 'h')
				}
			},
			begin:function(overload){
				this.STYLEPROPS(overload, 3)
				this.ALLOCDRAW(overload)
				var t = this.turtle
				t.shiftPadding(t._borderWidth)
				this.beginTurtle()
			}
		}
	}

	vertexPre(){}
	vertexStyle(){}
	pixelStyle(){}

	vertex(){$
		this.vertexPre()
		this.vertexStyle()

		if (this.visible < 0.5) return vec4(0.0)

		var delta = vec2(0.)
		if(this.mesh.z < 0.5){
			delta += this.shadowOffset.xy + vec2(this.shadowSpread) * (this.mesh.xy *2. - 1.)//+ vec2(this.shadowBlur*0.25) * meshmz
		}

		var pos = this.scrollAndClip(this.mesh.xy, delta)

		var adjust = 1.
		if(this.mesh.z < 0.5){
			// bail if we have no visible shadow
			if(abs(this.shadowOffset.x)<0.001 && abs(this.shadowOffset.y)<0.001 && this.shadowBlur<2.0 && abs(this.shadowSpread) < 0.001){
				return vec4(0)
			}
			adjust = max(1.,this.shadowBlur)
		}

		this.borderRadius = min(max(this.borderRadius,vec4(adjust)),vec4(min(this.w,this.h)*0.5))

		// if we use the same border radii and the same borders, we can take the fast path
		if((abs(this.borderRadius.x-this.borderRadius.y) + 
			abs(this.borderRadius.z-this.borderRadius.w) + 
			abs(this.borderRadius.x-this.borderRadius.z) +
			abs(this.borderWidth.x-this.borderWidth.y) + 
			abs(this.borderWidth.z-this.borderWidth.w) + 
			abs(this.borderWidth.x-this.borderWidth.z)) < 0.001){
			this.fastPath = 1.
		}
		else this.fastPath = 0.

		var br = this.borderRadius * 2. 
		
	
		return vec4(pos , 0., 1.0) * this.viewPosition * this.camPosition * this.camProjection
	}

	pixel(){$

		var quick =  vec4(
			max(this.borderRadius.x, this.borderRadius.w) + this.borderWidth.w,
			max(this.borderRadius.x, this.borderRadius.y)+ this.borderWidth.x,
			this.w - max(this.borderRadius.y, this.borderRadius.z) - this.borderWidth.y,
			this.h - max(this.borderRadius.z, this.borderRadius.w) - this.borderWidth.z
		)

		//var dt = vary.roundcornermax
		var p = this.mesh.xy * vec2(this.w, this.h)
		//return 'red'
		this.pixelStyle()
		
		// quick out
		if(this.mesh.z < 0.5){
			quick += vec4(this.shadowBlur,this.shadowBlur,-this.shadowBlur,-this.shadowBlur)
			if(p.x > quick.x && p.x < quick.z && p.y > quick.y && p.y < quick.w){
				// alright shadow
				return this.premulAlpha(this.shadowColor)
			}
		}
		else{
			if(p.x > quick.x && p.x < quick.z && p.y > quick.y && p.y < quick.w){
				return this.premulAlpha(this.color)
			}
		}
		var antialias = this.antialias(p)
		
		var br = this.borderRadius
		var hwh = vec2(.5*this.w, .5*this.h)
		var ph = abs(p-hwh)
		// the border fields

		var border = float()
		var mx = float()
		var my = float()

		if(this.fastPath>0.5){
			border = length(max(ph - (hwh - br.xx), 0.)) - br.x
		}
		else{
			var btl = length(max(ph - (hwh - br.xx), 0.)) - br.x
			var btr = length(max(ph - (hwh - br.yy), 0.)) - br.y
			var bbr = length(max(ph - (hwh - br.zz), 0.)) - br.z
			var bbl = length(max(ph - (hwh - br.ww), 0.)) - br.w 
			mx = clamp((this.mesh.x - .5)*1000., 0., 1.)
			my = clamp((this.mesh.y - .5)*1000., 0., 1.)
			// border field (same as shadow)
			border = mix(
				mix(btl, btr, mx), 
				mix(bbl, bbr, mx),my
			) 
		}

		if(this.mesh.z < 0.5){
			var shborder = border / this.shadowBlur
			return this.premulAlpha(mix(this.shadowColor, vec4(this.shadowColor.rgb,0.), pow(clamp(shborder+1., 0., 1.),1.2)))
		}
		else{ // inner field
			// inner radius
			var fill = float()
			if(this.fastPath > 0.5){
				var irx = max(br.x - max(this.borderWidth.x, this.borderWidth.w), 1.)
				fill = length(max(ph - (hwh - vec2(irx)) + this.borderWidth.wx, 0.)) - irx
			}
			else{
				var ir = vec4(
					max(br.x - max(this.borderWidth.x, this.borderWidth.w), 1.),
					max(br.y - max(this.borderWidth.y, this.borderWidth.x), 1.),
					max(br.z - max(this.borderWidth.y, this.borderWidth.z), 1.),
					max(br.w - max(this.borderWidth.w, this.borderWidth.z), 1.))
				// inner field displaced by inner radius and borderWidths
				var ftl = length(max(ph - (hwh - ir.xx) + this.borderWidth.wx, 0.)) - ir.x
				var ftr = length(max(ph - (hwh - ir.yy) + this.borderWidth.yx, 0.)) - ir.y
				var fbr = length(max(ph - (hwh - ir.zz) + this.borderWidth.yz, 0.)) - ir.z
				var fbl = length(max(ph - (hwh - ir.ww) + this.borderWidth.wz, 0.)) - ir.w
				// mix the fields
				fill = mix(mix(ftl, ftr, mx), mix(fbl, fbr, mx),my)
			}
				
			var borderfinal = vec4()
			// remove the error in the border
			if(abs(border - fill) < 0.1) borderfinal = vec4(this.color.rgb,0.)
			else borderfinal = mix(this.borderColor, vec4(this.borderColor.rgb, 0.), clamp(border*antialias+1.,0.,1.))

			return this.premulAlpha(mix(this.color, borderfinal, clamp(fill * antialias + 1., 0., 1.)))
		}
	}
}