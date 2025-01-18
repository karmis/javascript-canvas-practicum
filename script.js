const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');

let isDrawing = false; // Флаг, указывающий, идет ли процесс рисования комнаты
let points = []; // Массив для хранения точек комнаты
let sofa = null; // Объект для хранения данных о диване
let draggingSofa = false; // Флаг, указывающий, перемещается ли диван
let offsetX, offsetY; // Смещение курсора относительно центра дивана

const sofaImage = new Image();
sofaImage.src = 'sofa.png'; // Путь к изображению дивана
const sofaWidth = 100; // Ширина дивана
const sofaHeight = 50; // Высота дивана
const distanceForSnap = 8; // дистанция для снапа точек
const distanceForMagnet = 10 // дистанция для примагничивания дивана к стене
const distanceForLastSnap = 10; // дистанция между первой и последней точкой для завершения рисования комнаты
// Функция для рисования точки (узла стены)
function drawPoint(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2); // Рисуем круг радиусом 5 пикселей
    ctx.fillStyle = 'red'; // Цвет точки
    ctx.fill();
    ctx.closePath();
}

// Функция для рисования линии (стены) между двумя точками
function drawLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1); // Начало линии
    ctx.lineTo(x2, y2); // Конец линии
    ctx.strokeStyle = 'black'; // Цвет линии
    ctx.stroke();
    ctx.closePath();
}

// Функция для отрисовки комнаты (стен и точек)
function drawRoom() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Очищаем canvas
    for (let i = 0; i < points.length; i++) {
        drawPoint(points[i].x, points[i].y); // Рисуем точку
        if (i > 0) {
            drawLine(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y); // Рисуем стену между точками
        }
    }
}

// Функция для отрисовки дивана
function drawSofa(x, y, angle) {
    ctx.save(); // Сохраняем текущее состояние canvas
    ctx.translate(x, y); // Перемещаем начало координат в центр дивана
    ctx.rotate(angle); // Поворачиваем диван на заданный угол
    ctx.drawImage(sofaImage, -sofaWidth / 2, -sofaHeight / 2, sofaWidth, sofaHeight); // Рисуем диван
    ctx.restore(); // Восстанавливаем состояние canvas
}

// Функция для вычисления расстояния между двумя точками
function getDistance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); // Формула расстояния между точками
}

// Функция для примагничивания точки к ближайшей существующей точке
function snapToPoint(x, y) {
    for (let point of points) {
        if (Math.abs(x - point.x) <= distanceForSnap && Math.abs(y - point.y) <= distanceForSnap) {
            return point; // Возвращаем ближайшую точку, если она в пределах distanceForSnap пикселей
        }
    }
    return null; // Если близких точек нет, возвращаем null
}

// Функция для вычисления центра комнаты
function getCenter(points) {
    let x = points.reduce((sum, p) => sum + p.x, 0) / points.length; // Среднее значение X
    let y = points.reduce((sum, p) => sum + p.y, 0) / points.length; // Среднее значение Y
    return { x, y }; // Возвращаем координаты центра
}

// Функция для вычисления расстояния от точки до отрезка
function getDistanceToLineSegment(x1, y1, x2, y2, x, y) {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D; // Скалярное произведение
    const lenSq = C * C + D * D; // Квадрат длины отрезка
    let param = -1;
    if (lenSq !== 0) {
        param = dot / lenSq; // Параметр для проекции точки на отрезок
    }

    let xx, yy;

    if (param < 0) {
        xx = x1; // Точка ближе к началу отрезка
        yy = y1;
    } else if (param > 1) {
        xx = x2; // Точка ближе к концу отрезка
        yy = y2;
    } else {
        xx = x1 + param * C; // Точка проекции на отрезок
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy); // Расстояние от точки до отрезка
}

// Функция для поиска ближайшей стены к точке
function getClosestWall(x, y) {
    let minDistance = Infinity;
    let closestWall = null;

    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length]; // Замыкаем комнату, соединяя последнюю точку с первой

        const distance = getDistanceToLineSegment(p1.x, p1.y, p2.x, p2.y, x, y); // Расстояние до стены
        if (distance < minDistance) {
            minDistance = distance;
            closestWall = { p1, p2 }; // Сохраняем ближайшую стену
        }
    }

    return { closestWall, minDistance }; // Возвращаем ближайшую стену и расстояние до неё
}

// Функция для поиска ближайшей точки на стене к курсору
function getClosestPointOnWall(wall, x, y) {
    const dx = wall.p2.x - wall.p1.x;
    const dy = wall.p2.y - wall.p1.y;
    const length = Math.sqrt(dx * dx + dy * dy); // Длина стены

    const t = ((x - wall.p1.x) * dx + (y - wall.p1.y) * dy) / (length * length); // Параметр проекции
    const clampedT = Math.max(0, Math.min(1, t)); // Ограничиваем параметр в пределах [0, 1]

    return {
        x: wall.p1.x + clampedT * dx, // Ближайшая точка на стене по X
        y: wall.p1.y + clampedT * dy, // Ближайшая точка на стене по Y
    };
}

// Функция для проверки, помещается ли диван на стену
function canFitOnWall(wall, x, y, angle) {
    const dx = wall.p2.x - wall.p1.x;
    const dy = wall.p2.y - wall.p1.y;
    const wallLength = Math.sqrt(dx * dx + dy * dy); // Длина стены

    // Проверяем, помещается ли диван по длине стены
    if (wallLength < sofaWidth) {
        return false;
    }

    // Проверяем, не выходит ли диван за пределы стены
    const wallAngle = Math.atan2(dy, dx); // Угол стены
    const sofaProjection = Math.abs(sofaWidth * Math.cos(angle - wallAngle)); // Проекция дивана на стену

    return sofaProjection <= wallLength; // Возвращаем true, если диван помещается
}

// Обработчик клика на кнопку "Начать"
startButton.addEventListener('click', () => {
    isDrawing = true; // Начинаем рисование комнаты
    points = []; // Очищаем массив точек
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Очищаем canvas
});

// Обработчик клика на canvas
canvas.addEventListener('mousedown', (e) => {
    if (isDrawing) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left; // Координата X курсора
        const y = e.clientY - rect.top; // Координата Y курсора

        // Если расстояние между первой и последней точкой < 10 пикселей
        if (points.length > 0 && getDistance(x, y, points[0].x, points[0].y) < distanceForLastSnap) {
            // Завершаем рисование комнаты
            isDrawing = false;
            points.push({ x, y }); // Добавляем последнюю точку
            const center = getCenter(points); // Вычисляем центр комнаты
            sofa = { x: center.x, y: center.y, angle: 0 }; // Размещаем диван в центре
            drawRoom(); // Отрисовываем комнату
            drawSofa(sofa.x, sofa.y, sofa.angle); // Отрисовываем диван
        } else {
            const snappedPoint = snapToPoint(x, y); // Проверяем, нужно ли примагнитить точку
            if (snappedPoint) {
                points.push({ x: snappedPoint.x, y: snappedPoint.y }); // Примагничиваем к существующей точке
            } else {
                points.push({ x, y }); // Добавляем новую точку
            }
            drawRoom(); // Отрисовываем комнату
        }
    } else if (sofa) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Проверяем, находится ли курсор над диваном
        if (x > sofa.x - sofaWidth / 2 && x < sofa.x + sofaWidth / 2 &&
            y > sofa.y - sofaHeight / 2 && y < sofa.y + sofaHeight / 2) {
            draggingSofa = true; // Начинаем перемещение дивана
            offsetX = x - sofa.x; // Смещение курсора по X
            offsetY = y - sofa.y; // Смещение курсора по Y
        }
    }
});

// Обработчик перемещения мыши
canvas.addEventListener('mousemove', (e) => {
    if (isDrawing && points.length > 0) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left; // Координата X курсора
        const y = e.clientY - rect.top; // Координата Y курсора
        drawRoom(); // Отрисовываем комнату
        drawLine(points[points.length - 1].x, points[points.length - 1].y, x, y); // Рисуем временную стену
    } else if (draggingSofa && sofa) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left; // Координата X курсора
        const mouseY = e.clientY - rect.top; // Координата Y курсора

        // Проверяем расстояние до ближайшей стены
        const { closestWall, minDistance } = getClosestWall(mouseX, mouseY);

        if (minDistance <= distanceForMagnet && canFitOnWall(closestWall, mouseX, mouseY, sofa.angle)) {
            // Вычисляем угол стены
            const angle = Math.atan2(closestWall.p2.y - closestWall.p1.y, closestWall.p2.x - closestWall.p1.x);

            // Поворачиваем диван задней частью к стене
            sofa.angle = angle; // Угол поворота дивана

            // Находим ближайшую точку на стене к курсору
            const closestPoint = getClosestPointOnWall(closestWall, mouseX, mouseY);

            // Вычисляем смещение для примагничивания дивана к стене
            const offset = {
                x: Math.cos(angle + Math.PI / 2) * (sofaHeight / 2), // Смещение по X
                y: Math.sin(angle + Math.PI / 2) * (sofaHeight / 2), // Смещение по Y
            };

            // Примагничиваем диван к стене
            sofa.x = closestPoint.x + offset.x; // Позиция дивана по X
            sofa.y = closestPoint.y + offset.y; // Позиция дивана по Y
        } else {
            // Если диван не близко к стене, перемещаем его свободно
            sofa.x = mouseX - offsetX; // Позиция дивана по X
            sofa.y = mouseY - offsetY; // Позиция дивана по Y
        }

        drawRoom(); // Отрисовываем комнату
        drawSofa(sofa.x, sofa.y, sofa.angle); // Отрисовываем диван
    }
});

// Обработчик отпускания кнопки мыши
canvas.addEventListener('mouseup', () => {
    draggingSofa = false; // Завершаем перемещение дивана
});
