'use client';

import {
  Area,
  AreaChart,
  AreaSeries,
  ChartDataShape,
  ChartTooltip,
  Gradient,
  GradientStop,
  Gridline,
  GridlineSeries,
  Line,
  LinearAxisLine,
  LinearXAxis,
  LinearXAxisTickSeries,
  LinearYAxis,
  LinearYAxisTickSeries,
  MarkLine,
  TooltipArea,
} from 'reaviz';

import React, { useEffect, useState } from 'react';

// Generate flat line data when tokenId is undefined
const generateFlatData = (days: number = 30) => {
  const data = [];
  const now = new Date();
  const flatPrice = 0; // Fixed price for flat line

  for (let i = days; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

    data.push({
      price: flatPrice,
      timestamp: date.getTime(),
      date: date.toISOString().split('T')[0],
    });
  }

  return data;
};

// Dummy data for demonstration
const generateDummyData = (days: number = 30) => {
  const data = [];
  const now = new Date();
  const basePrice = 150 + Math.random() * 50; // Random base price between 150-200

  for (let i = days; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

    // Create more dramatic ups and downs
    const dayProgress = (days - i) / days;
    let price = basePrice;

    // Add multiple waves/cycles for ups and downs
    const wave1 = Math.sin(dayProgress * Math.PI * 4) * 30; // 4 cycles over the period
    const wave2 = Math.sin(dayProgress * Math.PI * 6) * 15; // 6 cycles for more variation
    const trend = dayProgress * 20; // Overall upward trend
    const noise = (Math.random() - 0.5) * 10; // Random noise

    price = Math.max(50, basePrice + wave1 + wave2 + trend + noise);

    data.push({
      price: price,
      timestamp: date.getTime(),
      date: date.toISOString().split('T')[0],
    });
  }

  return data;
};

const DUMMY_CHART_DATA = generateDummyData(30);
const FLAT_CHART_DATA = generateFlatData(30);
const DUMMY_MIN_MAX = [
  { price: Math.min(...DUMMY_CHART_DATA.map(d => d.price)) },
  { price: Math.max(...DUMMY_CHART_DATA.map(d => d.price)) },
];
const FLAT_MIN_MAX = [{ price: 0 }, { price: 0 }];

export function TokensChart({
  tokenId,
  chartData,
  loadingCharts,
  price,
  minMax,
  chainColor,
  selectedDays,
}: {
  tokenId?: string;
  chartData?: any[];
  loadingCharts?: boolean;
  price?: number;
  chainColor?: string;
  minMax?: any[];
  selectedDays?: string;
}) {
  // Use flat data if tokenId is undefined, otherwise use dummy data if no data provided
  const actualChartData = !tokenId
    ? FLAT_CHART_DATA
    : chartData?.length
      ? chartData
      : DUMMY_CHART_DATA;
  const actualMinMax = !tokenId
    ? FLAT_MIN_MAX
    : minMax?.length
      ? minMax
      : DUMMY_MIN_MAX;
  const actualChainColor = chainColor || '#7E6EBE';
  const actualSelectedDays = selectedDays || '30D';

  const [formattedChartData, setFormattedChartData] = useState<
    ChartDataShape[] | undefined
  >();

  useEffect(
    () =>
      setFormattedChartData(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actualChartData?.map((val: { price: any; date: any }) => {
          return {
            data: val.price,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            key: new Date((val as any).timestamp),
            metadata: val.date,
          };
        })
      ),
    [actualChartData]
  );

  return (
    <AreaChart
      height={128}
      xAxis={
        <LinearXAxis
          tickSeries={
            <LinearXAxisTickSeries
              tickSize={0}
              interval={5}
              label={null}
              line={null}
            />
          }
          axisLine={
            <LinearAxisLine
              strokeWidth={0}
              strokeColor={'hsl(var(--color-chart-axis))'}
            />
          }
          type={'time'}
        />
      }
      yAxis={
        <LinearYAxis
          tickSeries={
            <LinearYAxisTickSeries
              tickSize={0}
              width={0}
              interval={5}
              label={null}
              line={null}
            />
          }
          axisLine={<LinearAxisLine strokeWidth={0} />}
        />
      }
      series={
        <AreaSeries
          markLine={<MarkLine strokeColor={actualChainColor} strokeWidth={1} />}
          tooltip={
            <TooltipArea
              tooltip={
                <ChartTooltip
                  followCursor={true}
                  placement="auto"
                  modifiers={{
                    offset: '5px, 5px',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={(data: any) => {
                    const price = data.value + actualMinMax[0].price;

                    const date = new Date(data.key);
                    let formattedDate;

                    if (
                      actualSelectedDays === '1Y' ||
                      actualSelectedDays === 'YTD' ||
                      actualSelectedDays === 'All'
                    ) {
                      formattedDate = date.toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      });
                    } else {
                      formattedDate = date.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    }

                    return (
                      <div className="rounded border bg-[hsl(var(--color-chart-tooltip-bg))] p-2 text-[hsl(var(--color-chart-tooltip-text))]">
                        <div className="text-sm font-medium">
                          ${price.toFixed(2)}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {formattedDate}
                        </div>
                      </div>
                    );
                  }}
                />
              }
            />
          }
          colorScheme={actualChainColor}
          interpolation={'smooth'}
          line={<Line strokeWidth={2} />}
          area={
            <Area
              gradient={
                <Gradient
                  stops={[
                    <GradientStop
                      key={0}
                      offset="0"
                      stopOpacity={0}
                      color={actualChainColor}
                    />,
                    <GradientStop
                      key={2}
                      offset="1"
                      stopOpacity={0.55}
                      color={actualChainColor}
                    />,
                  ]}
                />
              }
            />
          }
        />
      }
      gridlines={
        <GridlineSeries
          line={
            <Gridline
              direction="all"
              strokeWidth={0}
              strokeColor={'hsl(var(--color-chart-grid))'}
            />
          }
        />
      }
      data={formattedChartData}
    />
  );
}
