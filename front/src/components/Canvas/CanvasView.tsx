interface CanvasViewProps {
    zoom: number;
}

export function CanvasView({ zoom }: CanvasViewProps) {
    return (
        <div className="canvas-view">
            <svg
                className="canvas-svg"
                style={{
                    transform: `scale(${zoom / 100})`,
                }}
                viewBox="0 0 1000 700"
                preserveAspectRatio="xMidYMid meet"
            >
                <defs>
                    {/* Мелкая сетка — 10 мм */}
                    <pattern
                        id="smallGrid"
                        width="10"
                        height="10"
                        patternUnits="userSpaceOnUse"
                    >
                        <path
                            d="M 10 0 L 0 0 0 10"
                            fill="none"
                            stroke="#292c31"
                            strokeWidth="0.5"
                        />
                    </pattern>

                    {/* Крупная сетка — 50 мм */}
                    <pattern
                        id="largeGrid"
                        width="50"
                        height="50"
                        patternUnits="userSpaceOnUse"
                    >
                        <rect
                            width="50"
                            height="50"
                            fill="url(#smallGrid)"
                        />

                        <path
                            d="M 50 0 L 0 0 0 50"
                            fill="none"
                            stroke="#363a41"
                            strokeWidth="1"
                        />
                    </pattern>
                </defs>

                {/* Фон рабочей области */}
                <rect
                    x="0"
                    y="0"
                    width="1000"
                    height="700"
                    fill="#15171a"
                />

                {/* Сетка */}
                <rect
                    x="0"
                    y="0"
                    width="1000"
                    height="700"
                    fill="url(#largeGrid)"
                />

                {/* Центральная ось X */}
                <line
                    x1="0"
                    y1="350"
                    x2="1000"
                    y2="350"
                    stroke="#41464e"
                    strokeWidth="1"
                />

                {/* Центральная ось Y */}
                <line
                    x1="500"
                    y1="0"
                    x2="500"
                    y2="700"
                    stroke="#41464e"
                    strokeWidth="1"
                />

                {/* Тестовая кожаная деталь 100 × 70 мм */}
                <rect
                    x="450"
                    y="315"
                    width="100"
                    height="70"
                    fill="#25282d"
                    stroke="#b8bdc5"
                    strokeWidth="1"
                />

                {/* Размер по горизонтали */}
                <text
                    x="500"
                    y="405"
                    textAnchor="middle"
                    fill="#8e949d"
                    fontSize="10"
                >
                    100 mm
                </text>

                {/* Размер по вертикали */}
                <text
                    x="565"
                    y="350"
                    textAnchor="middle"
                    fill="#8e949d"
                    fontSize="10"
                    transform="rotate(90 565 350)"
                >
                    70 mm
                </text>

                {/* Подпись масштаба */}
                <text
                    x="20"
                    y="30"
                    fill="#666b73"
                    fontSize="11"
                >
                    1 grid = 10 mm
                </text>
            </svg>

            <div className="canvas-info">
                <span>Canvas</span>
                <span>{zoom}%</span>
            </div>
        </div>
    );
}