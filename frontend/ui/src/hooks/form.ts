/**
 * 统一表单处理Hook库
 * 标准化项目中重复的表单处理模式，减少 useForm 相关的重复代码
 */

import { useState, useCallback, useEffect } from 'react'
import { useLoadingState, useErrorState } from './common'

/**
 * 表单字段配置接口
 */
export interface FormFieldConfig {
  required?: boolean
  validate?: (value: any) => string | null
  transform?: (value: any) => any
  defaultValue?: any
}

/**
 * 表单配置接口
 */
export interface FormConfig<T extends Record<string, any>> {
  fields: {
    [K in keyof T]?: FormFieldConfig
  }
  onSubmit?: (values: T) => void | Promise<void>
  validateOnChange?: boolean
  validateOnBlur?: boolean
}

/**
 * 表单状态接口
 */
export interface FormState<T extends Record<string, any>> {
  values: T
  errors: Partial<Record<keyof T, string>>
  touched: Partial<Record<keyof T, boolean>>
  isValid: boolean
  isDirty: boolean
}

/**
 * 统一的表单Hook
 * 解决项目中重复的表单处理模式
 */
export const useForm = <T extends Record<string, any>>(
  initialValues: T,
  config: FormConfig<T> = {}
) => {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
  const [isDirty, setIsDirty] = useState(false)
  
  const { loading: isSubmitting, startLoading, stopLoading } = useLoadingState()
  const { error: submitError, setError: setSubmitError, clearError } = useErrorState<string>()

  // 验证单个字段
  const validateField = useCallback((name: keyof T, value: any): string | null => {
    const fieldConfig = config.fields?.[name]
    
    // 必填验证
    if (fieldConfig?.required && (!value || value === '')) {
      return `${String(name)} is required`
    }
    
    // 自定义验证
    if (fieldConfig?.validate) {
      return fieldConfig.validate(value)
    }
    
    return null
  }, [config.fields])

  // 验证所有字段
  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {}
    let isValid = true

    Object.keys(values).forEach((key) => {
      const fieldKey = key as keyof T
      const error = validateField(fieldKey, values[fieldKey])
      if (error) {
        newErrors[fieldKey] = error
        isValid = false
      }
    })

    setErrors(newErrors)
    return isValid
  }, [values, validateField])

  // 设置字段值
  const setValue = useCallback((name: keyof T, value: any) => {
    setValues(prev => ({
      ...prev,
      [name]: value
    }))
    
    if (!isDirty) {
      setIsDirty(true)
    }

    // 实时验证（如果启用）
    if (config.validateOnChange) {
      const error = validateField(name, value)
      setErrors(prev => ({
        ...prev,
        [name]: error || undefined
      }))
    }
  }, [isDirty, config.validateOnChange, validateField])

  // 设置多个字段值
  const setValues = useCallback((newValues: Partial<T> | ((prev: T) => T)) => {
    if (typeof newValues === 'function') {
      setValues(newValues)
    } else {
      setValues(prev => ({
        ...prev,
        ...newValues
      }))
    }
    
    if (!isDirty) {
      setIsDirty(true)
    }
  }, [isDirty])

  // 设置字段为已触摸
  const setFieldTouched = useCallback((name: keyof T, isTouched = true) => {
    setTouched(prev => ({
      ...prev,
      [name]: isTouched
    }))

    // 失焦验证（如果启用）
    if (config.validateOnBlur && isTouched) {
      const error = validateField(name, values[name])
      setErrors(prev => ({
        ...prev,
        [name]: error || undefined
      }))
    }
  }, [config.validateOnBlur, validateField, values])

  // 重置表单
  const resetForm = useCallback((newInitialValues?: T) => {
    const resetValues = newInitialValues || initialValues
    setValues(resetValues)
    setErrors({})
    setTouched({})
    setIsDirty(false)
    clearError()
  }, [initialValues, clearError])

  // 提交表单
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    if (!validateForm()) {
      return
    }

    if (!config.onSubmit) {
      return
    }

    startLoading()
    clearError()

    try {
      // 转换值（如果有转换函数）
      const transformedValues = { ...values }
      Object.keys(values).forEach((key) => {
        const fieldKey = key as keyof T
        const fieldConfig = config.fields?.[fieldKey]
        if (fieldConfig?.transform) {
          transformedValues[fieldKey] = fieldConfig.transform(values[fieldKey])
        }
      })

      await config.onSubmit(transformedValues)
      
      // 提交成功后重置dirty状态
      setIsDirty(false)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Submission failed')
    } finally {
      stopLoading()
    }
  }, [validateForm, config.onSubmit, startLoading, clearError, values, config.fields, stopLoading, setSubmitError])

  // 获取字段属性（用于绑定到表单控件）
  const getFieldProps = useCallback((name: keyof T) => ({
    name: String(name),
    value: values[name] || '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(name, e.target.value)
    },
    onBlur: () => setFieldTouched(name, true),
    error: touched[name] ? errors[name] : undefined,
    helperText: touched[name] ? errors[name] : undefined,
  }), [values, errors, touched, setValue, setFieldTouched])

  // 计算表单是否有效
  const isValid = Object.keys(errors).length === 0 && Object.values(errors).every(error => !error)

  return {
    // 状态
    values,
    errors,
    touched,
    isValid,
    isDirty,
    isSubmitting,
    submitError,
    
    // 操作
    setValue,
    setValues: setValues,
    setFieldTouched,
    resetForm,
    handleSubmit,
    validateForm,
    validateField,
    getFieldProps,
    
    // 工具方法
    getFieldError: (name: keyof T) => errors[name],
    isFieldTouched: (name: keyof T) => !!touched[name],
    isFieldValid: (name: keyof T) => !errors[name],
  }
}

/**
 * 简化的表单Hook，适用于简单表单
 */
export const useSimpleForm = <T extends Record<string, any>>(
  initialValues: T,
  onSubmit?: (values: T) => void | Promise<void>
) => {
  return useForm(initialValues, {
    onSubmit,
    validateOnChange: false,
    validateOnBlur: true,
  })
}

/**
 * 对话框表单Hook
 * 针对项目中大量对话框表单的使用场景
 */
export const useDialogForm = <T extends Record<string, any>>(
  initialValues: T,
  options: {
    onSubmit?: (values: T) => void | Promise<void>
    onSuccess?: () => void
    onError?: (error: string) => void
    resetOnSuccess?: boolean
  } = {}
) => {
  const form = useForm(initialValues, {
    onSubmit: async (values) => {
      try {
        await options.onSubmit?.(values)
        options.onSuccess?.()
        
        if (options.resetOnSuccess) {
          form.resetForm()
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Operation failed'
        options.onError?.(errorMessage)
        throw error // 重新抛出以便表单Hook处理
      }
    },
    validateOnChange: true,
    validateOnBlur: true,
  })

  return form
}

/**
 * 搜索表单Hook
 * 用于搜索表单的防抖处理
 */
export const useSearchForm = <T extends Record<string, any>>(
  initialValues: T,
  onSearch: (values: T) => void,
  debounceDelay = 300
) => {
  const [debouncedValues, setDebouncedValues] = useState(initialValues)

  const form = useForm(initialValues, {
    validateOnChange: false,
    validateOnBlur: false,
  })

  // 防抖处理搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValues(form.values)
    }, debounceDelay)

    return () => clearTimeout(timer)
  }, [form.values, debounceDelay])

  // 当防抖值变化时触发搜索
  useEffect(() => {
    onSearch(debouncedValues)
  }, [debouncedValues, onSearch])

  return form
}

/**
 * 多步表单Hook
 */
export const useMultiStepForm = <T extends Record<string, any>>(
  steps: Array<{
    name: string
    fields: (keyof T)[]
    validate?: (values: T) => Record<string, string>
  }>,
  initialValues: T
) => {
  const [currentStep, setCurrentStep] = useState(0)
  
  const form = useForm(initialValues)

  const canGoNext = useCallback(() => {
    const currentStepConfig = steps[currentStep]
    if (!currentStepConfig) return false

    // 验证当前步骤的字段
    const hasErrors = currentStepConfig.fields.some(field => {
      const error = form.validateField(field, form.values[field])
      return !!error
    })

    return !hasErrors
  }, [currentStep, steps, form])

  const nextStep = useCallback(() => {
    if (canGoNext() && currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }, [canGoNext, currentStep, steps.length])

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step)
    }
  }, [steps.length])

  return {
    ...form,
    currentStep,
    currentStepConfig: steps[currentStep],
    canGoNext: canGoNext(),
    canGoPrev: currentStep > 0,
    isLastStep: currentStep === steps.length - 1,
    isFirstStep: currentStep === 0,
    nextStep,
    prevStep,
    goToStep,
    progress: ((currentStep + 1) / steps.length) * 100,
  }
}
