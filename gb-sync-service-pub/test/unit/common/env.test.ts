import { randomUUID } from "crypto"
import { env, envAsInteger } from "@gymbeam/aws-common/utils/env"

describe("env", () => {
  test("env valid variable", () => {
    const envName = randomUUID()
    process.env[envName] = "TEST"

    expect(env(envName)).toBe("TEST")
  })

  test("env undefined variable", () => {
    const envName = randomUUID()
    expect(() => env(envName)).toThrowError(/Invalid environment variable/)
  })

  test("envAsInteger valid variable", () => {
    const envName = randomUUID()
    process.env[envName] = "123"

    expect(envAsInteger(envName)).toBe(123)
  })

  test("envAsInteger undefined variable", () => {
    const envName = randomUUID()
    expect(() => envAsInteger(envName)).toThrowError(
      /Invalid environment variable/,
    )
  })

  test("envAsInteger non-numeric variable", () => {
    const envName = randomUUID()
    process.env[envName] = "abc"

    expect(() => envAsInteger(envName)).toThrowError(/expected to be a number/)
  })

  test("envAsInteger undefined variable, optional", () => {
    const envName = randomUUID()
    expect(envAsInteger(envName, { optional: true })).toBeUndefined()
  })
})
