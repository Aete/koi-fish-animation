class Random {

    constructor() {
        
        // A 타입과 B 타입 두 가지 난수 생성기가 있고, 그것을 고르는 Boolean
        this.useA = false;

        // sfc32 난수 생성기 https://github.com/bryc/code/blob/master/jshash/PRNGs.md
        let sfc32 = function(uint128Hex) {
            let a = parseInt(uint128Hex.substr(0, 8), 16);
            let b = parseInt(uint128Hex.substr(8, 8), 16);
            let c = parseInt(uint128Hex.substr(16, 8), 16);
            let d = parseInt(uint128Hex.substr(24, 8), 16);

            // 함수를 return, 함수가 실행될 때마다 계속해서 a,b,c,d가 업데이트 되면서 다른 값을 출력
            return function() {
                a |= 0; b |= 0; c |= 0; d |= 0; 
                let t = (a + b | 0) + d | 0;
                d = d + 1 | 0;
                a = b ^ b >>> 9;
                b = c + (c << 3) | 0;
                c = c << 21 | c >>> 11;
                c = c + t | 0;
                return (t >>> 0) / 4294967296;
            };
        };

        // seed prngA with first half of tokenData.hash
        this.prngA = new sfc32(tokenData.hash.substr(2, 32));
        // seed prngB with second half of tokenData.hash
        this.prngB = new sfc32(tokenData.hash.substr(34, 32));
    }



    // random number between 0 (inclusive) and 1 (exclusive)
    random_dec() {
        this.useA = !this.useA;
        return this.useA ? this.prngA() : this.prngB();
    }

    // random number between a (inclusive) and b (exclusive)
    random_num(a, b) {
        return a + (b - a) * this.random_dec();
    }

    // random integer between a (inclusive) and b (inclusive)
    // requires a < b for proper probability distribution
    random_int(a, b) {
        return Math.floor(this.random_num(a, b + 1));
    }

    // random value in an array of items
    random_choice(list) {
        return list[this.random_int(0, list.length - 1)];
    }
}

// 난수 생성기
let R = new Random();

// 필요한 변수들은 미리 선언한 뒤 setup 함수에서 값을 넣어줌 - 여기는 사각형 스타일과 관련된 부분
let multi, indexArray, multiX, cP, r, g, b, colorPicker, toggle4, toggle5, noiseVal, density;

//  - 여기는 사각형 스타일과 관련된 부분-2
let s, palettePicker, palettes, rBack, gBack, bBack, com;

// 사각형들을 넣을 빈 array 생성
let rectangles = [];

// 그리드의 사각형 갯수를 미리 array로 설정. 추후 난수 생성기를 통해 랜덤하게 값을 뽑아서 그리드를 생성함.
// 9는 가로축에 사각형 9개, 12는 가로축에 사각형 12개 이런 식으로 그리드를 설정함
// 그리드의 총 가로 길이는 고정값이기 때문에, 사각형 갯수가 많아질수록 사각형 크기는 줄어듬
let multiArray = [9, 12, 15, 18, 21];

// p5.js의 경우, 펄린 노이즈를 사용하는데, 입력값에 따라 자연스러운 스퀸스를 생성할 수 있음.
// 이 작품에서는 startingValue에다가 조금씩 changingValue를 더한 값을 noise의 입력값으로 활용하여 보다 부드러운 노이즈 생성
// 생성된 노이즈는 사각형 선 그리는데 활용
let startingValue = 0;

// noiseScale: 이 변수는 질감있는 배경을 그리는데 활용함.
let noiseScale = 0.02;

// 캔버스 설정과 관련된 부분
let cnv, paperGraph, ctx;

function setup() {
    // p5.js noiseSeed Function, fix a seed value for the noise function
    noiseSeed(R.random_int(0, 10000));

    // set a size of the p5 canvas with windowWidth & windowHeight from p5.js
    // 화면의 가로, 세로 비율에 따라서 캔버스 크기 설정. 가로:세로 = 7:9의 값으로 설정함
    let canvasSize = min(round(windowWidth * 9 / 7), windowHeight);
    cnv = createCanvas(round(canvasSize * 7 / 9), canvasSize);
    
    // 배경 그릴 부분은 따로 createGraphics 활용해서 분리, https://p5js.org/ko/reference/#/p5/createGraphics
    paperGraph = createGraphics(width, height);

    // 작품의 가로 크기는 canvasSize * 7 / 9, 세로 크기는 canvasSize
    // 이 작품에서는 그림을 그릴 때 최소 단위를 canvasSize / 900 으로 놓고 진행하는 거 같음
    // 가로 = s * 700, 세로 = s * 900 
    s = canvasSize / 900; 
    pixelDensity(2);

    // 별도로 canvas api를 활용하기 위해서 context 생성
    ctx = cnv.drawingContext;

    // 사각형 색 조합 미리 설정
    let palette1 = ['#ff7200', '#ff5e5e', '#140040', '#081F15', '#4D0269', '#DB7C00',
        '#4B94D8', '#155B9D', '#C268B6', '#1990FF'];

    let palette2 = ['#dc0000'];

    let palette3 = ['#000000'];

    let palette4 = ['#FF0000', '#DB0000', '#A50000', '#B60000', '#920000', '#6D0000',
        '#490000', '#240000', '#000000', '#2B2B2B', '#575757'];

    let palette5 = ['#005A00', '#016B59', '#005D0F', '#00601E', '#01632D', '#01653B', '#01684A'];

    let palette6 = ['#642000', '#7E3310', '#90492D', '#A65D44', '#BC715A', '#CF7B54', '#481700'];

    let palette7 = ['#006CAF', '#1760A6', '#2F549D', '#464893', '#5E3C8A', '#753181',
        '#8D2578', '#A4196E', '#BC0D65', '#D3015C'];

    let palette8 = ['#5B00B0', '#6A0A9C', '#791389', '#881D75', '#972762', '#A6304E',
        '#B53A3B', '#C44427', '#D34D14', '#E25700', '#B00000', '#C62700'];

    let palette9 = ['#DC0000', '#931E00', '#493C00', '#005A00', '#496500', '#927100',
        '#DB7C00', '#006249', '#006992', '#0071DB', '#B00000'];

    let palette10 = ['#1800B5'];

    let palette11 = ['#ff7200'];

    // array에 저장하고 바로 밑에서 난수 생성기를 통해 무작위로 뽑음
    palettes = [palette1, palette2, palette3, palette4, palette5, palette6, palette7,
        palette8, palette9, palette10, palette11];

    palettePicker = R.random_int(0, palettes.length - 1);

    // rectangles array에 저장될 사각형들의 스타일 설정값들
    com = [
        [50, 25, 10, 10, 5, 5, 5, 5, 0, 250],
        [5, 5, 4, 5, 5, 3, 5, 5, 0, 250],
        [1, 1, 2, 5, 5, 3, 50, 5, 2, 250],
        [1, 1, 3, 8, 5, 3, 8, 5, 2, 400],
        [5, 5, 3, 50, 5, 3, 50, 5, 5, 250],
        [25, 25, 1, 2, 25, 1, 2, 25, 0, 250],
        [25, 25, 2, 10, 25, 4, 6, 25, 0, 250],
        [25, 25, 4, 6, 25, 2, 10, 25, 0, 250],
        [25, 25, 1, 2, 25, 2, 10, 25, 0, 250],
        [25, 25, 2, 10, 25, 1, 2, 25, 0, 250],
        [25, 25, 2, 10, 25, 2, 10, 25, 0, 250],
        [50, 50, 1, 5, 50, 1, 5, 50, 0, 150],
        [5, 5, 15, 20, 5, 15, 20, 5, 0, 200],
        [5, 5, 10, 15, 5, 20, 25, 5, 10, 250],
        [5, 5, 3, 8, 25, 3, 8, 25, 0, 250],
        [50, 50, 1, 3, 50, 1, 3, 50, 0, 250],
        [25, 5, 2, 4, 25, 4, 12, 25, 0, 150],
        [25, 25, 1, 1, 25, 3, 12, 25, 0, 200],
        [25, 25, 3, 10, 25, 1, 1, 25, 0, 200],
        [50, 50, 2, 6, 50, 1, 3, 50, 0, 150]];

    // 바로 위에 설정값들 중에서 어떤 것을 쓸껀지 난수 생성기를 통해 index값을 저장
    cP = R.random_int(0, com.length - 1);
    multi = R.random_choice(multiArray); // grid에 들어갈 사각형 갯수
    indexArray = multiArray.indexOf(multi); // grid에 들어갈 사각형 갯수가 multiArray의 몇번째인 건지에 대한 값. 추후 사각형 그릴 때 활용됨
    multiX = (width - 100 * s) / multi; // grid 1칸 크기

    for (let i = 0; i < com[cP][9]; i++) {
        rectangles[i] = new Rectangle();
    }

    // 작품의 배경색 지정
    background(255);
    let backColor = ['#BDA491', '#D19D9D', '#AEAEE2', '#A5A5A5', '#CE9D8C', '#B395B0'];
    let backPicker = R.random_int(0, backColor.length - 1);
    rBack = red(backColor[backPicker]);
    gBack = green(backColor[backPicker]);
    bBack = blue(backColor[backPicker]);
}

function draw() {
    noiseDetail(10, 0.85);
    noiseScale *= s;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            noiseVal = noise((x * noiseScale) / 3, y * noiseScale);
            paperGraph.stroke(rBack, gBack, bBack, noiseVal * 100); // color of points rgba
            paperGraph.strokeWeight(1);
            paperGraph.point(x, y);
        }
    }

    for (let y = 0; y < height + 2; y += 1) {
        for (let x = 0; x < width + 1; x += 1) {
            noiseVal = constrain(noise((x * noiseScale) / 3, y * noiseScale), 0, 1.6);
            paperGraph.stroke(255, noiseVal * 100);
            paperGraph.strokeWeight(1);
            paperGraph.point(x - 1, y - 2);
        }
    }

    image(paperGraph, 0, 0);

    noiseDetail(4, 0.5);

    frame();

    // canvas 끝에 엣지를 주는 역할 수행
    push();
    translate(width / 2, height / 2) // 원점을 가운데로
    rectMode(CENTER);

    for (let jj = 0; jj < 8; jj++) {
        stroke(180, 1 + jj * 10);
        noFill()
        strokeWeight(1 * s);
        rect(0, 0, width - 5 + jj, height - 5 + jj, 4);    }
    pop();
    // canvas 끝에 엣지를 주는 역할 수행 - 끝

    // 여기까지는 작품 배경에 종이, 캔버스 같은 질감 넣는 부분

    noLoop();
    // 밑에서부터는 사각형 그리는 작업
    noStroke();

    // 사각형 색상 톤 잡는 역할
    toggle5 = R.random_num(0, 15);    
    
    // composition 변수에 따라서 작품은 크게 4가지 타입으로 나뉘어 그려짐
    let composition = R.random_num(0, 23);

    // 사각형 타입 1
    if (composition < 11) {
        toggle4 = R.random_num(0, 4);
        if (toggle4 < 2) {
            grid();
        }

        let rectSize = R.random_int(3, 4); // 3 혹은 4
        let optionX = multi - rectSize; // 사각형 x축 원점 최대값: (grid의 x축 사각형 갯수  - rectSize) / multiX
        let optionY = (indexArray + 2) * 4 + (4 - rectSize); 
        density = R.random_num(7, 10); // 사각형이 얼만큼 조밀하게 그려질 것인지를 설정
        for (let h = 0; h < multi * multi / density; h++) {
            noStroke();
            transparentRect(
                50 * s + R.random_int(0, optionX) * multiX, // transparentRect x 원점
                50 * s + R.random_int(0, optionY) * multiX, // transparentRect y 원점
                R.random_int(1, rectSize) * multiX, // transparentRect width
                R.random_int(1, rectSize) * multiX); // transparentRect height
        }
    }

    if (composition < 14 && composition >= 13) {
        grid();
        let toggle1 = R.random_int(0, 2);
        let randInFor = R.random_num(3, 12);
        for (let sn = 0; sn < multi * multi / randInFor; sn++) {
            pickColor();
            stroke(r, g, b, 150);
            let numX1 = int(R.random_num(0, multi));
            let numY1 = int(R.random_num(0, (multi * 4 / 3)));
            let numX2 = int(R.random_num(0, multi));
            let numY2 = int(R.random_num(0, (multi * 4 / 3)));
            if (toggle1 === 0) {
                bLine(
                    50 * s + numX1 * multiX,
                    50 * s + numY1 * multiX,
                    multiX * 2,
                    multiX / 5,
                    0)
            }

            if (toggle1 === 1) {
                bLine(
                    50 * s + numX1 * multiX,
                    50 * s + numY1 * multiX,
                    multiX * 2,
                    multiX / 5,
                    1)
            }

            if (toggle1 === 2) {
                bLine(
                    50 * s + numX1 * multiX,
                    50 * s + numY1 * multiX,
                    multiX * 2,
                    multiX / 5,
                    0)

                bLine(
                    50 * s + numX2 * multiX,
                    50 * s + numY2 * multiX,
                    multiX * 2,
                    multiX / 5,
                    1)
            }
        }
    }



    if (composition >= 14 && composition < 22.5) {
        for (let i = 0; i < rectangles.length; i++) {
            rectangles[i].size(); // check locations and sizes of the rectangles
            rectangles[i].display();
            for (let j = 0; j < rectangles.length; j++) {
                if (i !== j && rectangles[i].intersects(rectangles[j])) {
                    rectangles[j].delete();
                }
            }
        }

        for (let i = 0; i < rectangles.length; i++) {
            if (rectangles[i].x === -1000) {
                rectangles.splice(i, 1);
                i++;
            }
        }
    }



    if (composition >= 22.5) {
        multiX = (width - 100 * s) / 9;
        for (let rt = 0; rt < 8; rt++) {
            let toggle1 = R.random_int(0, 1);
            if (toggle1 === 0) {
                transparentRect(
                    50 * s + rt * (multiX + 9.5 * s),
                    50 * s,
                    multiX,
                    height - 100 * s);
            }
        }

        for (let rt = 0; rt < 10; rt++) {
            let toggle2 = R.random_int(0, 1);
            if (toggle2 === 0) {
                transparentRect(
                    50 * s,
                    50 * s + rt * (multiX + 14 * s),
                    width - 100 * s,
                    multiX + 6 * s);
            }
        }
    }
}


// 두 개의 좌표 사이에 점을 계속해서 찍어 나가는 함수
function xLine(x1, y1, x2, y2, z, changingValue, additional){
    let length = dist(x1, y1, x2, y2);
    
    // s값은 canvasSize/900 === width / 700 === height/900
    for (let i = 0; i < length; i += additional * s) {
        let x = lerp(x1, x2, i / length);
        let y = lerp(y1, y2, i / length);
        xPoint(x, y, z, changingValue);
    }
}


// 좌표에다가 선굵기에 노이즈를 더해서 점을 찍는 함수
function xPoint(x, y, z, changingValue) {
    startingValue += changingValue;
    let weightValue = noise(startingValue);
    ctx.lineWidth = weightValue * z * s;
    drawPoint(x,y);
}

// 좌표에다가 점 찍는 함수
function drawPoint(x,y){
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
}

// 그리드 그리는 함수
function grid() {
    for (let gridY = 50 * s; gridY < height - 25 * s; gridY += multiX) {
        stroke(150, 150, 150, R.random_num(0, 100));
        xLine((50 - R.random_num(-5, 10)) * s, gridY,
            (width - 50 * s) + R.random_num(-5, 10) * s, gridY, 0.7, 0.1, 0.5);
    }

    for (let gridX = 50 * s; gridX < width - 25 * s; gridX += multiX) {
        stroke(150, 150, 150, R.random_num(0, 100));
        xLine(gridX, (50 - R.random_num(-5, 10)) * s, gridX,
            (height - 50 * s) + R.random_num(-5, 10) * s, 0.7, 0.1, 0.5);
    }

}


// 프레임 그리는 함수, toogle3 값에 따라 그릴지 말지 결정
function frame() {
    let toggle3 = R.random_num(0, 3);

    if (toggle3 < 2) {
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
        
        xLine(50 * s, (50 - R.random_num(5, 15)) * s, 50 * s,
            (height - 50 * s) + R.random_num(5, 15) * s, 0.7, 0.1, 0.5);
        xLine(width - 50 * s, (50 - R.random_num(5, 15)) * s, width - 50 * s,
            (height - 50 * s) + R.random_num(5, 15) * s, 0.7, 0.1, 0.5);
        xLine((50 - R.random_num(5, 15)) * s, 50 * s,
            (width - 50 * s) + R.random_num(5, 15) * s, 50 * s, 0.7, 0.1, 0.5);
        xLine((50 - R.random_num(5, 15)) * s, (height - 50 * s),
            (width - 50 * s) + R.random_num(5, 15) * s, (height - 50 * s), 0.7, 0.1, 0.5);
    }
}



function transparentRect(startX, startY, sizeX, sizeY) {


    pickColor(); // r, g, b 색 세팅

    // 사각형 칠하기
    fill(r, g, b, 30); // rgb 값과 투명도 30으로 사각형 그림
    rect(startX, startY, sizeX, sizeY); 

    // 사각형 선 그리기
    stroke(r, g, b, 5); // 선 색은 투명도 5로 그림
    xLine(startX, startY, startX, startY + sizeY, 4, 0.03, 0.5);
    xLine(startX, startY, startX + sizeX, startY, 4, 0.03, 0.5);
    xLine(startX + sizeX, startY, startX + sizeX, startY + sizeY, 4, 0.03, 0.5);
    xLine(startX, startY + sizeY, startX + sizeX, startY + sizeY, 4, 0.03, 0.5);
    
    noStroke();

    // 얼룩덜룩함 표현, rect는 좀 큰 덩어리, drawPoint는 좁쌀 같이 보임
    for (let de = 0; de < 150; de++) {
        fill(r, g, b, R.random_num(1, 1.5));
        let sMin = min(sizeX / 6, sizeY / 6);
        noStroke();
        rect(
            R.random_num(startX, startX + sizeX - sMin),
            R.random_num(startY, startY + sizeY - sMin),
            sMin,
            sMin,
            sMin * 0.3); // 5번째 값은 모퉁이 trim 값
        stroke(r, g, b, 5);
        strokeWeight(R.random_num(0.1, 0.2) * sMin * s);
        drawPoint(R.random_num(startX, startX + sizeX),
            R.random_num(startY, startY + sizeY))
    }

    startX = round(startX);
    startY = round(startY);
    let yOff = startX / width * s;
    for (let y = startY; y < startY + sizeY; y += 1) {
        
        let xOff = startY / height * s;
        
        for (let x = startX; x < startX + sizeX; x += 1) {
            let noiseOpacity = noise(xOff, yOff) * 105;
            strokeWeight(1);
            stroke(r, g, b, noiseOpacity - 50);
            point(x, y);
            xOff += 0.01 / s;
        }

        yOff += 0.0035 / s;
    }
}



class Rectangle {

    constructor() {
        this.x = 50 * s + R.random_int(0, 700 / com[cP][0]) * com[cP][0] * s;
        this.y = 50 * s + R.random_int(0, 900 / com[cP][1]) * com[cP][1] * s;
        this.w = R.random_int(com[cP][2], com[cP][3]) * com[cP][4] * s;
        this.h = R.random_int(com[cP][5], com[cP][6]) * com[cP][7] * s;
    }

    // 사각형이 잘린다면 사각형을 화면 밖으로 보내버림 // 그리고 나서 for 문 돌려서 삭제 (315번째줄 코드 참조)
    size() {
        if (this.x + this.w - 0.5 > width - 49 * s ||
            this.y + this.h - 0.5 > height - 49 * s) {
            this.x = -1000;
            this.y = -1000;
            this.h = 0;
            this.w = 0;
        }
    }

    display() {
        transparentRect(this.x, this.y, this.w, this.h);
    }

    // 마찬가지로 사각형을 화면 밖으로 보내버리는 코드.
    delete() {
        this.x = -1000;
        this.y = -1000;
        this.w = 0;
        this.h = 0;
    }

    // 사각형들이 서로 겹치는지 아닌지 판단해주는 코드
    intersects(other) {
        return this.x < other.x + other.w + com[cP][8] - 0.5 &&
            this.x + this.w + com[cP][8] - 0.5 > other.x &&
            this.y < other.y + other.h + com[cP][8] - 0.5 &&
            this.y + this.h + com[cP][8] - 0.5 > other.y;
    }
}



function brush(xPos, yPos) {
    let maxR = 0.5 * s;
    for (let ji = 0; ji < 8; ji++) {
        let a = R.random_num(0, 2 * PI);
        let r = (sqrt(R.random_num(0, 1))) * maxR;
        let x = r * cos(a) + xPos;
        let y = r * sin(a) + yPos;
        ctx.lineWidth = R.random_num(0, 0.5) * s;
        drawPoint(x, y);
    }
}

function bLine(x, y, n, m, t) {
    let xb, yb;
    let toggle2 = t;
    let amt = round(n / s);

    for (let th = 0; th < (m + 0.1) / s; th++) {
        // 세로로 그려라
        if (toggle2 === 0) {
            xb = x + R.random_num(-0.5, 0.5) * s;
            yb = y + R.random_num(-1.5, 1.5) * s;
            for (let h = 0; h < amt; h++) {
                brush(xb + 5 * th * s, yb);
                xb = xb + R.random_num(-0.08, 0.08) * s;
                yb = yb + s / 2;
            }
        }

        // 가로로 그려라
        if (toggle2 === 1) {
            xb = x + R.random_num(-1.5, 1.5) * s;
            yb = y + R.random_num(-0.5, 0.5) * s;
            for (let h = 0; h < 10; h++) {
                brush(xb, yb + 5 * th * s);
                xb = xb + s / 2;
                yb = yb + R.random_num(-0.08, 0.08) * s;
            }
        }
    }
}

function pickColor() {
    if (toggle5 < 5) {
        r = R.random_num(0, 200);
        g = R.random_num(0, 120);
        b = R.random_num(0, 120);
    }

    if (toggle5 < 7 && toggle5 >= 5) {
        r = R.random_num(0, 255);
        g = R.random_num(0, 100);
        b = 0;
    }

    if (toggle5 < 8 && toggle5 >= 7) {
        r = R.random_num(0, 100);
        g = R.random_num(0, 120);
        b = R.random_num(0, 200);
    }

    if (toggle5 < 9 && toggle5 >= 8) {
        r = R.random_num(0, 200);
        g = R.random_num(0, 120);
        b = R.random_num(0, 200);
    }

    if (toggle5 >= 9) {
        colorPicker = R.random_int(0, palettes[palettePicker].length - 1);
        r = red(palettes[palettePicker][colorPicker]);
        g = green(palettes[palettePicker][colorPicker]);
        b = blue(palettes[palettePicker][colorPicker]);
    }
}